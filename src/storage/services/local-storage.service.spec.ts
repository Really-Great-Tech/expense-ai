import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LocalStorageService } from './local-storage.service';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
jest.mock('path');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;

describe('LocalStorageService', () => {
  let service: LocalStorageService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LocalStorageService>(LocalStorageService);
    configService = module.get<ConfigService>(ConfigService) as jest.Mocked<ConfigService>;

    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup default config and path mocks
    configService.get.mockReturnValue('./uploads');
    mockPath.join.mockImplementation((...args) => args.join('/'));
    mockPath.dirname.mockReturnValue('uploads');
    mockPath.basename.mockImplementation((p) => p.split('/').pop() || '');
    mockPath.extname.mockImplementation((p) => {
      const parts = p.split('.');
      return parts.length > 1 ? `.${parts.pop()}` : '';
    });
    mockPath.resolve.mockImplementation((p) => `/resolved/${p}`);
    
    // Mock process.cwd() for some tests
    process.cwd = jest.fn().mockReturnValue('/app');
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const buffer = Buffer.from('test file content');
      const key = 'user1/test.pdf';
      
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockReturnValue(undefined);

      const result = await service.uploadFile(buffer, key);

      expect(result).toBe('user1/test.pdf');
      expect(mockFs.mkdirSync).toHaveBeenCalledWith('uploads', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('./uploads/user1/test.pdf', buffer);
    });

    it('should throw error when file write fails', async () => {
      const buffer = Buffer.from('test file content');
      const key = 'uploads/user1/test.pdf';
      
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      await expect(service.uploadFile(buffer, key)).rejects.toThrow('Write failed');
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const testBuffer = Buffer.from('test file content');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(testBuffer);

      const result = await service.downloadFile('test.pdf');

      expect(result).toBe(testBuffer);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('./uploads/test.pdf');
    });

    it('should throw error when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(service.downloadFile('nonexistent.pdf')).rejects.toThrow('File not found');
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      const exists = await service.fileExists('test.pdf');

      expect(exists).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith('./uploads/test.pdf');
    });

    it('should return false when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const exists = await service.fileExists('test.pdf');

      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockReturnValue(undefined);

      await service.deleteFile('test.pdf');

      expect(mockFs.unlinkSync).toHaveBeenCalledWith('./uploads/test.pdf');
    });

    it('should handle delete failure gracefully', async () => {
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await expect(service.deleteFile('test.pdf')).rejects.toThrow('Delete failed');
    });
  });

  describe('saveResult', () => {
    it('should save result as JSON successfully', async () => {
      const testData = { processed: true, results: ['item1', 'item2'] };
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockReturnValue(undefined);

      await service.saveResult('results/test-result.json', testData);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'results/test-result.json',
        JSON.stringify(testData, null, 2),
        'utf8'
      );
    });
  });

  describe('loadResult', () => {
    it('should load and parse JSON result successfully', async () => {
      const testData = { processed: true, results: ['item1', 'item2'] };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(testData));

      const result = await service.loadResult('results/test-result.json');

      expect(result).toEqual(testData);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('results/test-result.json', 'utf8');
    });

    it('should throw error for invalid JSON', async () => {
      mockFs.readFileSync.mockReturnValue('invalid json');

      await expect(service.loadResult('results/test-result.json')).rejects.toThrow();
    });
  });

  describe('ensureDirectory', () => {
    it('should create directory when it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);

      await service.ensureDirectory('uploads/user1');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('uploads/user1', { recursive: true });
    });

    it('should not create directory when it already exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await service.ensureDirectory('uploads/user1');

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('moveFile', () => {
    it('should move file successfully', async () => {
      mockFs.renameSync.mockReturnValue(undefined);

      await service.moveFile('temp/file.pdf', 'uploads/file.pdf');

      expect(mockFs.renameSync).toHaveBeenCalledWith('temp/file.pdf', 'uploads/file.pdf');
    });
  });

  describe('readLocalConfigFile', () => {
    it('should read and parse config file successfully', async () => {
      const configData = { setting1: 'value1', setting2: 'value2' };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(configData));
      
      process.cwd = jest.fn().mockReturnValue('/app');

      const result = await service.readLocalConfigFile('config/app.json');

      expect(result).toEqual(configData);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/app/config/app.json', 'utf8');
    });

    it('should throw error when config file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      process.cwd = jest.fn().mockReturnValue('/app');

      await expect(service.readLocalConfigFile('config/nonexistent.json')).rejects.toThrow('Config file not found');
    });
  });

  describe('validateLocalFile', () => {
    it('should return true for valid file', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => true, size: 1024 } as any);

      const isValid = await service.validateLocalFile('uploads/test.pdf');

      expect(isValid).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const isValid = await service.validateLocalFile('uploads/nonexistent.pdf');

      expect(isValid).toBe(false);
    });

    it('should return false for directory instead of file', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isFile: () => false, size: 0 } as any);

      const isValid = await service.validateLocalFile('uploads/');

      expect(isValid).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    it('should return file info when file exists', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      const fileInfo = await service.getFileInfo('uploads/test.pdf');

      expect(fileInfo).toEqual({
        size: 2048,
        exists: true
      });
    });

    it('should return exists false when file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const fileInfo = await service.getFileInfo('uploads/nonexistent.pdf');

      expect(fileInfo).toEqual({
        size: 0,
        exists: false
      });
    });
  });
});
