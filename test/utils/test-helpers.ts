import { Express } from 'express';

export const createMockLogger = () => ({
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
});

export const createMockFile = (overrides?: Partial<Express.Multer.File>): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'test.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 1024,
  destination: './uploads/temp',
  filename: 'test-file.pdf',
  path: './uploads/temp/test-file.pdf',
  buffer: Buffer.from('test file content'),
  stream: null as any,
  ...overrides,
});

export const createMockQueue = () => ({
  add: jest.fn(),
  getJobs: jest.fn(),
  getJobCounts: jest.fn(),
  process: jest.fn(),
});

export const createMockConfigService = () => ({
  get: jest.fn(),
});

export const createMockBedrockClient = () => ({
  send: jest.fn(),
});

export const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

export const createMockRequest = (overrides?: any) => ({
  user: { id: 'test-user' },
  body: {},
  query: {},
  params: {},
  headers: {},
  ...overrides,
});

export const mockProcessingStatus = {
  jobId: 'test-job-123',
  status: 'completed' as const,
  progress: {
    fileClassification: true,
    dataExtraction: true,
    issueDetection: true,
    citationGeneration: true,
  },
  results: {
    classification: { is_expense: true, expense_type: 'invoice' },
    extraction: { amount: 100, currency: 'USD' },
    compliance: { validation_result: { is_valid: true } },
  },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:05:00Z'),
};

export const mockJobData = {
  jobId: 'test-job-123',
  status: 'queued',
  userId: 'test-user',
  sessionId: 'test-session-123',
};
