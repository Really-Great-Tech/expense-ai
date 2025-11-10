import { TextractApiService } from './textractReader';
import { TextractClient, DetectDocumentTextCommand, AnalyzeDocumentCommand } from '@aws-sdk/client-textract';

// Mock fs module with controllable implementations
const mockExistsSync = jest.fn();
const mockStatSync = jest.fn();
const mockReadFileSync = jest.fn();

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: (...args: any[]) => mockExistsSync(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

jest.mock('@aws-sdk/client-textract', () => {
  const actual = jest.requireActual('@aws-sdk/client-textract');
  const TextractClientMock = jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  }));
  return {
    ...actual,
    TextractClient: TextractClientMock,
  };
});

describe('TextractApiService', () => {
  const createService = () => new TextractApiService({ region: 'us-east-1', uploadPath: './uploads' });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReset();
    mockStatSync.mockReset();
    mockReadFileSync.mockReset();
  });

  const mockExists = (exists: boolean) => {
    mockExistsSync.mockReturnValue(exists);
  };

  const mockStat = (size: number) => {
    mockStatSync.mockReturnValue({ size } as any);
  };

  const mockReadBuffer = (buffer: Buffer) => {
    mockReadFileSync.mockReturnValue(buffer);
  };

  const getSendMock = () => {
    const instances = (TextractClient as unknown as jest.Mock).mock.instances;
    if (!instances.length) {
      throw new Error('TextractClient was not instantiated');
    }
    return instances[0].send as jest.Mock;
  };

  it('should fail security validation for unsupported file extension', async () => {
    const service = createService();

    const res: any = await service.parseDocument('uploads/file.txt');

    expect(res.success).toBe(false);
    expect(res.error).toContain('Unsupported file extension: .txt');
  });

  it('should fail when file does not exist', async () => {
    const service = createService();

    mockExists(false);

    const res: any = await service.parseDocument('uploads/missing.pdf');

    expect(res.success).toBe(false);
    expect(res.error).toContain('File not found');
  });

  it('should process multi-page PDF by splitting and combining pages', async () => {
    const service = createService();

    // Minimal PDF-like buffer with 2 page indicators
    const pdfHeader = Buffer.from('%PDF-1.7\n/Type /Page\n/Type /Page\n', 'utf-8');
    mockExists(true);
    mockStat(4096);
    mockReadBuffer(pdfHeader);

    const splitSpy = jest.spyOn(service as any, 'splitPdfIntoPages').mockResolvedValue([
      // Return 2 page buffers (use PNG-like headers to route single-page path)
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 1]),
    ]);

    const pageResults = ['First page text', 'Second page text'];
    const singleSpy = jest.spyOn(service as any, 'processSinglePageDocument').mockImplementation(async (_buf: Buffer, _cfg: any, ...rest: any[]) => {
      const idx = (service as any).__test_idx__ ?? 0;
      (service as any).__test_idx__ = idx + 1;
      return { success: true, data: pageResults[idx] };
    });

    const res: any = await service.parseDocument('uploads/multi.pdf');

    expect(splitSpy).toHaveBeenCalledTimes(1);
    expect(singleSpy).toHaveBeenCalledTimes(2);

    expect(res.success).toBe(true);
    expect(res.data).toContain('## Page 1');
    expect(res.data).toContain('## Page 2');
    expect(res.data).toContain('First page text');
    expect(res.data).toContain('Second page text');
  });

  it('should fail when file exceeds Textract size limit', async () => {
    const service = createService();

    // PNG header but too large size
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
    mockExists(true);
    mockStat(10 * 1024 * 1024 + 1); // just over 10MB
    mockReadBuffer(pngHeader);

    const res: any = await service.parseDocument('uploads/too-big.png');

    expect(res.success).toBe(false);
    expect(res.error).toContain('File too large for Textract');
  });

  it('should fail security validation when outside allowed directories', async () => {
    const service = createService();

    const res: any = await service.parseDocument('notallowed/file.pdf');

    expect(res.success).toBe(false);
    expect(res.error).toContain('File path not within allowed directories');
  });
});
