const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const repo = require('./repository');
const uploadRepo = require('../uploads/repository');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif'];

const MAGIC_BYTES = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
};

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const uploadsRoot = path.resolve(projectRoot, config.uploadDir);

/**
 * Detect MIME type from the first bytes of a buffer.
 */
function detectMimeFromBuffer(buf) {
  if (!buf || buf.length < 4) return null;
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buf[i] === byte)) return mime;
    }
  }
  return null;
}

/**
 * Verify that a stored path is within the uploads directory
 * (prevents directory traversal).
 */
function isValidUploadPath(dbSavedPath) {
  if (!dbSavedPath) return true;
  const absolutePath = path.resolve(projectRoot, dbSavedPath);
  const relative = path.relative(uploadsRoot, absolutePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Parse multipart form data and return structured fields + file data.
 */
async function parseMultipartSubmission(req) {
  const parts = req.parts();
  let task_id = null;
  let didComment = false;
  let didRepost = false;
  let didShare = false;
  const filesData = [];

  for await (const part of parts) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      if (buffer.length > 0) {
        filesData.push({
          filename: part.filename,
          mimetype: part.mimetype,
          buffer: buffer,
          truncated: part.file.truncated,
        });
      }
    } else {
      switch (part.fieldname) {
        case 'task_id':
          task_id = part.value;
          break;
        case 'didComment':
          didComment = part.value === 'true';
          break;
        case 'didRepost':
          didRepost = part.value === 'true';
          break;
        case 'didShare':
          didShare = part.value === 'true';
          break;
      }
    }
  }

  return { task_id, didComment, didRepost, didShare, filesData };
}

/**
 * Validate uploaded files (type, extension, size, magic bytes).
 * Returns { valid: true } or { valid: false, error: string }.
 */
function validateFiles(filesData) {
  if (filesData.length === 0) {
    return { valid: false, error: 'Image file required' };
  }
  if (filesData.length > 5) {
    return { valid: false, error: 'Maximum 5 images allowed' };
  }

  for (const data of filesData) {
    const ext = path.extname(data.filename).toLowerCase();
    if (!ALLOWED_MIMES.includes(data.mimetype) || !ALLOWED_EXTS.includes(ext)) {
      return { valid: false, error: 'Only JPEG, PNG, GIF images are allowed' };
    }
    if (data.truncated) {
      return { valid: false, error: 'File size exceeds limit' };
    }
    const firstChunk = data.buffer.subarray(0, 16);
    const detectedMime = detectMimeFromBuffer(firstChunk);
    if (!detectedMime || detectedMime !== data.mimetype) {
      return {
        valid: false,
        error: 'File contents do not match declared image type',
      };
    }
  }

  return { valid: true };
}

/**
 * Write validated files to disk and return the DB-relative paths.
 * Cleans up on failure.
 */
async function saveFiles(filesData) {
  const absoluteUploadDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    config.uploadDir
  );
  await fs.promises.mkdir(absoluteUploadDir, { recursive: true });

  const dbSavedPaths = [];
  const writtenFiles = [];

  try {
    for (const data of filesData) {
      const ext = path.extname(data.filename).toLowerCase();
      const filename = uuidv4() + ext;
      const uploadPath = path.join(absoluteUploadDir, filename);
      await fs.promises.writeFile(uploadPath, data.buffer);
      writtenFiles.push(uploadPath);
      dbSavedPaths.push(['uploads', filename].join('/'));
    }
  } catch (error) {
    for (const file of writtenFiles) {
      try {
        await fs.promises.unlink(file);
      } catch (_) {
        // Ignore cleanup errors
      }
    }
    throw error;
  }

  return dbSavedPaths;
}

/**
 * Submit proof: orchestrates file validation, saving, DB insert, and
 * authorization check.
 */
async function submitProof(
  userId,
  { task_id, didComment, didRepost, didShare, filesData }
) {
  // Authorization: the intern must actually be assigned to the task
  const isAssigned = await repo.isTaskAssignedToUser(task_id, userId);
  if (!isAssigned) {
    const err = new Error('You are not assigned to this task');
    err.statusCode = 403;
    throw err;
  }

  if (!didComment && !didRepost && !didShare) {
    const err = new Error('At least one engagement action must be selected.');
    err.statusCode = 400;
    throw err;
  }

  const validation = validateFiles(filesData);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  const dbSavedPaths = await saveFiles(filesData);

  return repo.submitProofWithImages(task_id, userId, dbSavedPaths, {
    didComment,
    didRepost,
    didShare,
  });
}

/**
 * Delete a proof and its associated files from disk.
 */
async function deleteProofById(proofId) {
  const proof = await repo.getProof(proofId);
  if (!proof) return null;

  if (proof.image_path && !isValidUploadPath(proof.image_path)) {
    const err = new Error('Directory traversal attempt detected');
    err.statusCode = 400;
    throw err;
  }

  if (proof.images && proof.images.length > 0) {
    for (const img of proof.images) {
      if (!isValidUploadPath(img)) {
        const err = new Error('Directory traversal attempt detected');
        err.statusCode = 400;
        throw err;
      }
    }
  }

  await repo.deleteProof(proofId);

  // Delete legacy image if it exists
  if (proof.image_path) {
    await uploadRepo.deleteFile(proof.image_path).catch(() => {});
  }

  // Delete multiple images if they exist
  if (proof.images && proof.images.length > 0) {
    await Promise.all(
      proof.images.map((imgPath) =>
        uploadRepo.deleteFile(imgPath).catch(() => {})
      )
    );
  }

  return proof;
}

/**
 * Delete a single proof image and its file from disk.
 */
async function deleteProofImageById(imageId) {
  const image = await repo.getProofImage(imageId);
  if (!image) return null;

  if (image.image_path && !isValidUploadPath(image.image_path)) {
    const err = new Error('Directory traversal attempt detected');
    err.statusCode = 400;
    throw err;
  }

  await repo.deleteProofImage(imageId);
  await uploadRepo.deleteFile(image.image_path).catch(() => {});

  return image;
}

module.exports = {
  parseMultipartSubmission,
  validateFiles,
  saveFiles,
  submitProof,
  deleteProofById,
  deleteProofImageById,
  isValidUploadPath,
  detectMimeFromBuffer,
};
