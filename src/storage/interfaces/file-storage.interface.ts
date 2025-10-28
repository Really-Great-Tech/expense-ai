export interface FileStorageService {
  // Document operations
  uploadFile(buffer: Buffer, key: string, metadata?: Record<string, string>): Promise<string>
  downloadFile(key: string): Promise<Buffer>
  getFileInfo(key: string): Promise<{size: number, exists: boolean}>
  fileExists(key: string): Promise<boolean>
  deleteFile(key: string): Promise<void>
  
  // Result operations  
  saveResult(key: string, data: any): Promise<void>
  loadResult(key: string): Promise<any>
  
  // Directory operations (for LocalStorageService)
  ensureDirectory(path: string): Promise<void>
  
  // File moving (for LocalStorageService temp uploads)
  moveFile(sourcePath: string, destPath: string): Promise<void>
  
  // File reading operations
  readFile(key: string): Promise<Buffer>
  readFileAsString(key: string): Promise<string>

  // Additional methods for validation results and markdown extractions
  saveValidationResult(key: string, data: any): Promise<void>
  saveMarkdownExtraction(key: string, content: string): Promise<void>
  
  // Helper method for reading config files (schemas, compliance data)
  readLocalConfigFile(relativePath: string): Promise<any>
  
  // Helper method for file validation
  validateLocalFile(filePath: string): Promise<boolean>
}

export interface FileMetadata {
  size: number
  exists: boolean
  lastModified?: Date
  contentType?: string
}
