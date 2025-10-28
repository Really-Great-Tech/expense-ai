// Core data types based on Python implementation

export interface ProcessingResult {
  status: boolean;
  message: string;
  data: any;
}

export interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  progress?: number;
  error?: string;
}

export interface DocumentSummaryRequest {
  filePath: string;
  userId: string;
  language: string;
}

// Utility types for better type safety
export type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };

export interface Logger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

// Document Reader Types
export interface DocumentReaderConfig {
  timeout?: number;
  [key: string]: any;
}

export interface DocumentReader {
  parseDocument(filePath: string, config?: DocumentReaderConfig): Promise<ApiResponse<string>>;
}

export enum DocumentReaderType {
  TEXTRACT = 'textract',
}

export interface TextractConfig extends DocumentReaderConfig {
  featureTypes?: string[];
  outputFormat?: 'markdown' | 'text';
}
