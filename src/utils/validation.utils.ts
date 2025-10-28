import * as path from 'path';
import * as fs from 'fs';

export class ValidationUtils {
  /**
   * Validates file path to prevent path traversal attacks
   */
  static validateFilePath(filePath: string): void {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }
    
    // Normalize path and check for path traversal attempts
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
      throw new Error('Invalid file path: path traversal detected');
    }
  }

  /**
   * Validates file existence and properties
   */
  static validateFile(filePath: string, maxSize: number = 50 * 1024 * 1024): void {
    this.validateFilePath(filePath);
    
    const normalizedPath = path.normalize(filePath);
    
    if (!fs.existsSync(normalizedPath)) {
      throw new Error('File does not exist');
    }
    
    const stats = fs.statSync(normalizedPath);
    if (!stats.isFile()) {
      throw new Error('Path does not point to a valid file');
    }
    
    if (stats.size > maxSize) {
      throw new Error('File size exceeds maximum allowed limit');
    }
  }

  /**
   * Sanitizes user input to prevent injection attacks
   */
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/[{}]/g, '') // Remove potential JSON injection
      .replace(/[;|&$`]/g, '') // Remove potential command injection chars
      .trim();
  }

  /**
   * Validates and sanitizes filename
   */
  static validateFileName(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename provided');
    }
    
    // Remove any path components
    const baseName = path.basename(filename);
    
    // Check for valid characters (alphanumeric, dots, dashes, underscores)
    if (!/^[a-zA-Z0-9._-]+$/.test(baseName)) {
      throw new Error('Filename contains invalid characters');
    }
    
    if (baseName.length > 255) {
      throw new Error('Filename too long');
    }
    
    return baseName;
  }

  /**
   * Validates email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates URL format
   */
  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Escapes HTML to prevent XSS
   */
  static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validates UUID format
   */
  static validateUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
