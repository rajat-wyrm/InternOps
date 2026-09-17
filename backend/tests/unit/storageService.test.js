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
