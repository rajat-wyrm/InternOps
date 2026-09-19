const path = require('path');
const fs = require('fs');
const config = require('../../src/config');
const storageService = require('../../src/services/storageService');

describe('Storage Service Unit Tests', () => {
  const originalStorageConfig = { ...config.storage };

  afterEach(() => {
    config.storage = { ...originalStorageConfig };
    storageService._resetS3ClientInstance();
  });

  describe('compressAvatar()', () => {
    it('returns a WebP buffer when sharp is available', async () => {
      // Create a 1x1 PNG image buffer for testing
      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      );

      const compressed = await storageService.compressAvatar(pngBuffer);

      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('rejects corrupted image data without returning the original buffer', async () => {
      const corruptedPng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('not-a-decodable-image'),
      ]);

      try {
        await storageService.compressAvatar(corruptedPng);
        throw new Error('Expected corrupted avatar processing to fail');
      } catch (error) {
        expect([
          'INVALID_AVATAR_IMAGE',
          'AVATAR_PROCESSOR_UNAVAILABLE',
        ]).toContain(error.code);

        if (error.code === 'INVALID_AVATAR_IMAGE') {
          expect(error.statusCode).toBe(400);
          expect(error.message).toBe('Invalid or corrupted avatar image');
        }
      }
    });

    it('fails closed when avatar processing is unavailable', async () => {
      const nonImageBuffer = Buffer.from('arbitrary non-image content');

      await expect(
        storageService.processAndUploadAvatar(nonImageBuffer, 'issue_2007')
      ).rejects.toMatchObject({
        code: expect.stringMatching(
          /^(INVALID_AVATAR_IMAGE|AVATAR_PROCESSOR_UNAVAILABLE)$/
        ),
      });
    });
  });

  describe('uploadBuffer()', () => {
    it('falls back to local disk storage when driver is local', async () => {
      config.storage = {
        driver: 'local',
        isCloudConfigured: false,
      };

      const testBuffer = Buffer.from('test-image-content');
      const testKey = `test_upload_${Date.now()}.webp`;

      const resultUrl = await storageService.uploadBuffer(testBuffer, testKey);

      expect(resultUrl).toBe(`/uploads/${testKey}`);

      const projectRoot = path.resolve(__dirname, '..', '..');
      const localFilePath = path.resolve(
        projectRoot,
        config.uploadDir,
        testKey
      );
      expect(fs.existsSync(localFilePath)).toBe(true);

      // Clean up test file
      fs.unlinkSync(localFilePath);
    });
  });

  describe('deleteFile()', () => {
    it('removes local files when fileUrl starts with /uploads/', async () => {
      const projectRoot = path.resolve(__dirname, '..', '..');
      const uploadDir = path.resolve(projectRoot, config.uploadDir);

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const tempFileName = `temp_delete_${Date.now()}.txt`;
      const tempFilePath = path.join(uploadDir, tempFileName);

      fs.writeFileSync(tempFilePath, 'temporary file to delete');
      expect(fs.existsSync(tempFilePath)).toBe(true);

      await storageService.deleteFile(`/uploads/${tempFileName}`);

      expect(fs.existsSync(tempFilePath)).toBe(false);
    });
  });
});
