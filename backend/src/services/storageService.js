const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../logger');

let S3Client = null;
let PutObjectCommand = null;
let DeleteObjectCommand = null;

try {
  const s3Sdk = require('@aws-sdk/client-s3');
  S3Client = s3Sdk.S3Client;
  PutObjectCommand = s3Sdk.PutObjectCommand;
  DeleteObjectCommand = s3Sdk.DeleteObjectCommand;
} catch (err) {
  // @aws-sdk/client-s3 optional in minimal test setups
}

let cloudinary = null;
try {
  cloudinary = require('cloudinary').v2;
} catch (err) {
  // cloudinary optional in minimal test setups
}

let sharp = null;
try {
  sharp = require('sharp');
} catch (err) {
  // sharp optional in minimal test setups
}

let s3ClientInstance = null;

function getS3Client() {
  if (s3ClientInstance) return s3ClientInstance;
  if (!S3Client || !config.storage?.isCloudConfigured) return null;

  const { region, endpoint, accessKeyId, secretAccessKey } = config.storage;

  s3ClientInstance = new S3Client({
    region: region || 'auto',
    endpoint: endpoint || undefined,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3ClientInstance;
}

/**
 * Compresses an avatar image buffer: auto-orients, crops to a 300x300 square,
 * and converts to WebP format.
 */
async function compressAvatar(buffer) {
  if (!sharp) {
    const error = new Error('Avatar image processing is unavailable');
    error.code = 'AVATAR_PROCESSOR_UNAVAILABLE';
    error.statusCode = 503;
    throw error;
  }

  try {
    return await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize(300, 300, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (cause) {
    const error = new Error('Invalid or corrupted avatar image', {
      cause,
    });
    error.code = 'INVALID_AVATAR_IMAGE';
    error.statusCode = 400;
    throw error;
  }
}
/**
 * Compresses a general image buffer: auto-orients, resizes to a max width,
 * and converts to WebP format.
 */
async function compressImage(buffer, maxWidth = 1200) {
  if (!sharp) {
    return buffer;
  }

  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: maxWidth,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    logger.warn(
      { err: err.message },
      '[storageService] Image compression failed; storing original buffer'
    );
    return buffer;
  }
}

/**
 * Uploads a processed buffer to Cloudinary, Cloudflare R2 / S3, or local disk.
 * Returns the public target URL.
 */
async function uploadBuffer(buffer, key, mimeType = 'image/webp') {
  const storageConfig = config.storage || {};

  // 1. Cloudinary Upload
  if (
    storageConfig.driver === 'cloudinary' &&
    storageConfig.cloudinary?.isConfigured &&
    cloudinary
  ) {
    try {
      cloudinary.config({
        cloud_name: storageConfig.cloudinary.cloudName,
        api_key: storageConfig.cloudinary.apiKey,
        api_secret: storageConfig.cloudinary.apiSecret,
        secure: true,
      });

      const publicId = key.replace(/\.[^/.]+$/, '');

      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            folder: 'internops/avatars',
            resource_type: 'image',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        stream.end(buffer);
      });

      return await uploadPromise;
    } catch (err) {
      logger.error(
        { err: err.message, key },
        '[storageService] Cloudinary upload failed; falling back to local file storage'
      );
    }
  }

  // 2. Cloudflare R2 / AWS S3 Upload
  const isCloudDriver = ['r2', 's3'].includes(storageConfig.driver);
  const client = isCloudDriver ? getS3Client() : null;

  if (client && PutObjectCommand && storageConfig.bucketName) {
    try {
      const command = new PutObjectCommand({
        Bucket: storageConfig.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await client.send(command);

      if (storageConfig.publicUrl) {
        return `${storageConfig.publicUrl}/${key}`;
      }

      if (storageConfig.endpoint) {
        const cleanEndpoint = storageConfig.endpoint.replace(/\/+$/, '');
        return `${cleanEndpoint}/${storageConfig.bucketName}/${key}`;
      }

      return `https://${storageConfig.bucketName}.r2.cloudflarestorage.com/${key}`;
    } catch (err) {
      logger.error(
        { err: err.message, key },
        '[storageService] R2/S3 upload failed; falling back to local file storage'
      );
    }
  }

  // 3. Local Disk Storage Fallback
  const projectRoot = path.resolve(__dirname, '..', '..');
  const uploadDir = path.resolve(projectRoot, config.uploadDir || 'uploads');

  await fs.promises.mkdir(uploadDir, { recursive: true });

  const targetPath = path.join(uploadDir, key);
  await fs.promises.writeFile(targetPath, buffer);

  return `/uploads/${key}`;
}

/**
 * Processes and uploads a user avatar.
 */
async function processAndUploadAvatar(buffer, userId) {
  const compressedBuffer = await compressAvatar(buffer);
  const randomHash = crypto.randomBytes(6).toString('hex');
  const key = `avatar_${userId}_${randomHash}.webp`;

  const publicUrl = await uploadBuffer(compressedBuffer, key, 'image/webp');
  return {
    url: publicUrl,
    fileName: key,
    fileSize: compressedBuffer.length,
    mimeType: 'image/webp',
  };
}

/**
 * Deletes a file from Cloudinary, R2/S3, or local disk based on the URL scheme.
 */
async function deleteFile(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return;

  const storageConfig = config.storage || {};

  // Cloudinary URL deletion
  if (fileUrl.includes('res.cloudinary.com')) {
    if (cloudinary && storageConfig.cloudinary?.isConfigured) {
      try {
        cloudinary.config({
          cloud_name: storageConfig.cloudinary.cloudName,
          api_key: storageConfig.cloudinary.apiKey,
          api_secret: storageConfig.cloudinary.apiSecret,
          secure: true,
        });

        const parts = fileUrl.split('/upload/');
        if (parts[1]) {
          const pathParts = parts[1].replace(/^v\d+\//, '').split('.');
          const publicId = pathParts[0];
          await cloudinary.uploader.destroy(publicId);
        }
      } catch (err) {
        logger.warn(
          { err: err.message, fileUrl },
          '[storageService] Failed to delete file from Cloudinary'
        );
      }
    }
    return;
  }

  // Cloud URL deletion (HTTPS - R2 / S3)
  if (/^https?:\/\//i.test(fileUrl)) {
    const client = getS3Client();
    if (!client || !DeleteObjectCommand || !storageConfig.bucketName) return;

    try {
      const urlObj = new URL(fileUrl);
      const key = urlObj.pathname.replace(/^\/+/, '');
      if (!key) return;

      const command = new DeleteObjectCommand({
        Bucket: storageConfig.bucketName,
        Key: key,
      });

      await client.send(command);
    } catch (err) {
      logger.warn(
        { err: err.message, fileUrl },
        '[storageService] Failed to delete file from R2/S3'
      );
    }
    return;
  }

  // Local File System deletion (/uploads/...)
  if (fileUrl.startsWith('/uploads/')) {
    try {
      const fileName = path.basename(fileUrl);
      const projectRoot = path.resolve(__dirname, '..', '..');
      const uploadDir = path.resolve(
        projectRoot,
        config.uploadDir || 'uploads'
      );
      const filePath = path.join(uploadDir, fileName);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      logger.warn(
        { err: err.message, fileUrl },
        '[storageService] Failed to delete local file'
      );
    }
  }
}

module.exports = {
  compressAvatar,
  compressImage,
  uploadBuffer,
  processAndUploadAvatar,
  deleteFile,
  _resetS3ClientInstance: () => {
    s3ClientInstance = null;
  },
};
