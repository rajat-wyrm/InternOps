const validateEnv = require('../../src/config/validateEnv');

describe('Environment Variable Validation Tests', () => {
  let originalEnv;
  let exitMock;
  let errorMock;
  let warnMock;

  beforeEach(() => {
    // Backup original environment variables
    originalEnv = { ...process.env };

    // Mock process.exit
    exitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Mock console methods
    errorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;

    // Restore mocks
    exitMock.mockRestore();
    errorMock.mockRestore();
    warnMock.mockRestore();
  });

  it('should skip validation in test environment', () => {
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'test';

    validateEnv();

    expect(exitMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('should pass if all required and optional environment variables are present', () => {
    process.env.JWT_SECRET = 'secret';
    process.env.DATABASE_URL = 'postgresql://localhost:5432';
    process.env.NODE_ENV = 'development';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.EMAIL_API_KEY = 'api-key';

    validateEnv();

    expect(exitMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('should terminate the process if JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.DATABASE_URL = 'postgresql://localhost:5432';
    process.env.NODE_ENV = 'development';

    validateEnv();

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('❌ Missing required environment variables:')
    );
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('• JWT_SECRET')
    );
  });

  it('should terminate the process if DATABASE_URL is missing', () => {
    process.env.JWT_SECRET = 'secret';
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'development';

    validateEnv();

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('❌ Missing required environment variables:')
    );
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('• DATABASE_URL')
    );
  });

  it('should terminate the process if NODE_ENV is missing', () => {
    process.env.JWT_SECRET = 'secret';
    process.env.DATABASE_URL = 'postgresql://localhost:5432';
    delete process.env.NODE_ENV;

    validateEnv();

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('❌ Missing required environment variables:')
    );
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('• NODE_ENV')
    );
  });

  it('should terminate the process if a required variable is whitespace only', () => {
    process.env.JWT_SECRET = '   ';
    process.env.DATABASE_URL = 'postgresql://localhost:5432';
    process.env.NODE_ENV = 'development';

    validateEnv();

    expect(exitMock).toHaveBeenCalledWith(1);
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('❌ Missing required environment variables:')
    );
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('• JWT_SECRET')
    );
  });

  it('should print warnings but not terminate if optional variables are missing', () => {
    process.env.JWT_SECRET = 'secret';
    process.env.DATABASE_URL = 'postgresql://localhost:5432';
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.EMAIL_API_KEY;

    validateEnv();

    expect(exitMock).not.toHaveBeenCalled();
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('⚠️ Missing optional environment variables:')
    );
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('• REDIS_URL')
    );
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('• GOOGLE_CLIENT_ID')
    );
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('• EMAIL_API_KEY')
    );
  });
});
