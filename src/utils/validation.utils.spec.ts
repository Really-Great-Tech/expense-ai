import { ValidationUtils } from './validation.utils';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('ValidationUtils', () => {
  describe('validateFilePath', () => {
    it('should accept valid relative file path', () => {
      expect(() => ValidationUtils.validateFilePath('uploads/test.pdf')).not.toThrow();
    });

    it('should throw error for path traversal with ..', () => {
      expect(() => ValidationUtils.validateFilePath('../../../etc/passwd')).toThrow(
        'Invalid file path: path traversal detected'
      );
    });

    it('should throw error for absolute paths', () => {
      expect(() => ValidationUtils.validateFilePath('/etc/passwd')).toThrow(
        'Invalid file path: path traversal detected'
      );
    });

    it('should throw error for null or undefined', () => {
      expect(() => ValidationUtils.validateFilePath(null as any)).toThrow('Invalid file path provided');
      expect(() => ValidationUtils.validateFilePath(undefined as any)).toThrow('Invalid file path provided');
    });

    it('should throw error for non-string input', () => {
      expect(() => ValidationUtils.validateFilePath(123 as any)).toThrow('Invalid file path provided');
    });

    it('should throw error for empty string', () => {
      expect(() => ValidationUtils.validateFilePath('')).toThrow('Invalid file path provided');
    });
  });

  describe('validateFile', () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should validate existing file within size limit', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isFile: () => true,
        size: 1024,
      } as fs.Stats);

      expect(() => ValidationUtils.validateFile('uploads/test.pdf')).not.toThrow();
    });

    it('should throw error for non-existent file', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() => ValidationUtils.validateFile('uploads/missing.pdf')).toThrow('File does not exist');
    });

    it('should throw error for directory path', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isFile: () => false,
        size: 1024,
      } as fs.Stats);

      expect(() => ValidationUtils.validateFile('uploads/')).toThrow('Path does not point to a valid file');
    });

    it('should throw error for file exceeding size limit', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isFile: () => true,
        size: 100 * 1024 * 1024, // 100MB
      } as fs.Stats);

      expect(() => ValidationUtils.validateFile('uploads/large.pdf')).toThrow(
        'File size exceeds maximum allowed limit'
      );
    });

    it('should accept custom max size', () => {
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({
        isFile: () => true,
        size: 10 * 1024 * 1024, // 10MB
      } as fs.Stats);

      expect(() => ValidationUtils.validateFile('uploads/test.pdf', 5 * 1024 * 1024)).toThrow(
        'File size exceeds maximum allowed limit'
      );
    });

    it('should reject path traversal attempts', () => {
      expect(() => ValidationUtils.validateFile('../sensitive/file.txt')).toThrow(
        'Invalid file path: path traversal detected'
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      expect(ValidationUtils.sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    });

    it('should remove JSON injection characters', () => {
      expect(ValidationUtils.sanitizeInput('test{inject}data')).toBe('testinjectdata');
    });

    it('should remove command injection characters', () => {
      expect(ValidationUtils.sanitizeInput('rm -rf; ls | cat')).toBe('rm -rf ls  cat');
    });

    it('should trim whitespace', () => {
      expect(ValidationUtils.sanitizeInput('  test input  ')).toBe('test input');
    });

    it('should return empty string for null/undefined', () => {
      expect(ValidationUtils.sanitizeInput(null as any)).toBe('');
      expect(ValidationUtils.sanitizeInput(undefined as any)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(ValidationUtils.sanitizeInput(123 as any)).toBe('');
    });

    it('should handle empty string', () => {
      expect(ValidationUtils.sanitizeInput('')).toBe('');
    });
  });

  describe('validateFileName', () => {
    it('should accept valid filenames', () => {
      expect(ValidationUtils.validateFileName('document.pdf')).toBe('document.pdf');
      expect(ValidationUtils.validateFileName('test_file-123.txt')).toBe('test_file-123.txt');
      expect(ValidationUtils.validateFileName('file.v1.2.3.pdf')).toBe('file.v1.2.3.pdf');
    });

    it('should extract basename from path', () => {
      expect(ValidationUtils.validateFileName('uploads/subfolder/test.pdf')).toBe('test.pdf');
      // Path.basename extracts 'file.pdf' which is valid
      expect(ValidationUtils.validateFileName('test/file.pdf')).toBe('file.pdf');
    });

    it('should throw error for invalid characters', () => {
      expect(() => ValidationUtils.validateFileName('test@file.pdf')).toThrow('Filename contains invalid characters');
      expect(() => ValidationUtils.validateFileName('test file.pdf')).toThrow('Filename contains invalid characters');
      expect(() => ValidationUtils.validateFileName('test*file.pdf')).toThrow('Filename contains invalid characters');
    });

    it('should throw error for filename too long', () => {
      const longName = 'a'.repeat(256) + '.pdf';
      expect(() => ValidationUtils.validateFileName(longName)).toThrow('Filename too long');
    });

    it('should throw error for null/undefined', () => {
      expect(() => ValidationUtils.validateFileName(null as any)).toThrow('Invalid filename provided');
      expect(() => ValidationUtils.validateFileName(undefined as any)).toThrow('Invalid filename provided');
    });

    it('should throw error for empty string', () => {
      expect(() => ValidationUtils.validateFileName('')).toThrow('Invalid filename provided');
    });

    it('should throw error for non-string input', () => {
      expect(() => ValidationUtils.validateFileName(123 as any)).toThrow('Invalid filename provided');
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(ValidationUtils.validateEmail('user@example.com')).toBe(true);
      expect(ValidationUtils.validateEmail('test.user@domain.co.uk')).toBe(true);
      expect(ValidationUtils.validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(ValidationUtils.validateEmail('invalid')).toBe(false);
      expect(ValidationUtils.validateEmail('invalid@')).toBe(false);
      expect(ValidationUtils.validateEmail('@domain.com')).toBe(false);
      expect(ValidationUtils.validateEmail('user@domain')).toBe(false);
      expect(ValidationUtils.validateEmail('user @domain.com')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(ValidationUtils.validateEmail('')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      expect(ValidationUtils.validateUrl('https://example.com')).toBe(true);
      expect(ValidationUtils.validateUrl('http://localhost:3000')).toBe(true);
      expect(ValidationUtils.validateUrl('ftp://files.example.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(ValidationUtils.validateUrl('not-a-url')).toBe(false);
      expect(ValidationUtils.validateUrl('')).toBe(false);
      expect(ValidationUtils.validateUrl('just text')).toBe(false);
      expect(ValidationUtils.validateUrl('://broken')).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(ValidationUtils.escapeHtml('<div>Test</div>')).toBe('&lt;div&gt;Test&lt;/div&gt;');
    });

    it('should escape ampersands', () => {
      expect(ValidationUtils.escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(ValidationUtils.escapeHtml('"Hello" \'World\'')).toBe('&quot;Hello&quot; &#039;World&#039;');
    });

    it('should escape multiple special characters', () => {
      const dangerous = '<script>alert("XSS & \'injection\'")</script>';
      const escaped = ValidationUtils.escapeHtml(dangerous);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#039;injection&#039;&quot;)&lt;/script&gt;');
    });

    it('should handle empty string', () => {
      expect(ValidationUtils.escapeHtml('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(ValidationUtils.escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('validateUuid', () => {
    it('should accept valid UUIDs', () => {
      expect(ValidationUtils.validateUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(ValidationUtils.validateUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true);
      expect(ValidationUtils.validateUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true);
    });

    it('should accept UUIDs with uppercase letters', () => {
      expect(ValidationUtils.validateUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(ValidationUtils.validateUuid('not-a-uuid')).toBe(false);
      expect(ValidationUtils.validateUuid('550e8400-e29b-41d4-a716')).toBe(false);
      expect(ValidationUtils.validateUuid('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
      expect(ValidationUtils.validateUuid('550e8400e29b41d4a716446655440000')).toBe(false); // Missing hyphens
      expect(ValidationUtils.validateUuid('')).toBe(false);
    });

    it('should reject UUIDs with invalid version', () => {
      expect(ValidationUtils.validateUuid('550e8400-e29b-61d4-a716-446655440000')).toBe(false); // Version 6
    });

    it('should reject UUIDs with invalid variant', () => {
      expect(ValidationUtils.validateUuid('550e8400-e29b-41d4-c716-446655440000')).toBe(false); // Invalid variant
    });
  });
});
