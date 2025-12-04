export enum StorageEventPattern {
  UPLOAD_REQUESTED = 'storage.upload.requested',
  UPLOAD_COMPLETED = 'storage.upload.completed',
  UPLOAD_FAILED = 'storage.upload.failed',
  DOWNLOAD_REQUESTED = 'storage.download.requested',
  DOWNLOAD_COMPLETED = 'storage.download.completed',
  DELETE_REQUESTED = 'storage.delete.requested',
  DELETE_COMPLETED = 'storage.delete.completed',
}

export interface StorageUploadRequestEvent {
  file: Buffer;
  fileName: string;
  userId: string;
  metadata?: Record<string, any>;
  requestId: string;
}

export interface StorageUploadCompletedEvent {
  storageKey: string;
  storageType: 'local' | 's3';
  storageBucket: string;
  fileName: string;
  fileSize: number;
  requestId: string;
}

export interface StorageUploadFailedEvent {
  fileName: string;
  error: string;
  requestId: string;
}

export interface StorageDownloadRequestEvent {
  storageKey: string;
  storageType: 'local' | 's3';
  storageBucket: string;
  requestId: string;
}

export interface StorageDownloadCompletedEvent {
  storageKey: string;
  file: Buffer;
  requestId: string;
}

export interface StorageDeleteRequestEvent {
  storageKey: string;
  storageType: 'local' | 's3';
  storageBucket: string;
  requestId: string;
}

export interface StorageDeleteCompletedEvent {
  storageKey: string;
  deleted: boolean;
  requestId: string;
}

