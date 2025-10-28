export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo: {
    originalName: string;
    mimeType: string;
    size: number;
    extension: string;
    pageCount?: number;
    detectedType: string;
  };
  securityFlags: SecurityFlag[];
  processingHints: ProcessingHint[];
}

export interface SecurityFlag {
  type: 'MALICIOUS_PATTERN' | 'SUSPICIOUS_FILENAME' | 'OVERSIZED' | 'INVALID_FORMAT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  blocked: boolean;
}

export interface ProcessingHint {
  type: 'PAGE_COUNT' | 'COMPLEXITY' | 'QUALITY' | 'FORMAT_SPECIFIC';
  value: any;
  description: string;
}

export interface FileTypeConfig {
  extensions: string[];
  maxSize: number;
  maxPages?: number;
  magicNumbers: number[];
  processingComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MaliciousPattern {
  pattern: RegExp;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface FileValidationMetrics {
  isValid: boolean;
  fileSize: number;
  mimeType: string;
  processingTime: number;
  errorCount: number;
  warningCount: number;
}
