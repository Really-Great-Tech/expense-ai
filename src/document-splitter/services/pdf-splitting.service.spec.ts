import { Test, TestingModule } from '@nestjs/testing';
import { PdfSplittingService } from './pdf-splitting.service';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import { PageAnalysisResult } from '../types/document-splitter.types';

jest.mock('fs/promises');
jest.mock('pdf-lib');

describe('PdfSplittingService', () => {
  let service: PdfSplittingService;
  let mockPdfDocument: any;

  beforeEach(async () => {
    mockPdfDocument = {
      copyPages: jest.fn(),
      addPage: jest.fn(),
      save: jest.fn(),
    };

    (PDFDocument.create as jest.Mock) = jest.fn().mockResolvedValue(mockPdfDocument);
    (PDFDocument.load as jest.Mock) = jest.fn().mockResolvedValue({
      getPageCount: jest.fn().mockReturnValue(10),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfSplittingService],
    }).compile();

    service = module.get<PdfSplittingService>(PdfSplittingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('createSplitPdfFiles', () => {
    const mockAnalysis: PageAnalysisResult = {
      totalInvoices: 2,
      pageGroups: [
        {
          invoiceNumber: 1,
          pages: [1, 2],
          confidence: 0.95,
          reasoning: 'Clear invoice structure',
        },
        {
          invoiceNumber: 2,
          pages: [3, 4],
          confidence: 0.90,
          reasoning: 'Standard invoice',
        },
      ],
    };

    beforeEach(() => {
      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('pdf content'));
      mockPdfDocument.copyPages.mockResolvedValue([{}, {}]);
      mockPdfDocument.save.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    });

    it('should create split PDF files successfully', async () => {
      const result = await service.createSplitPdfFiles(
        '/path/to/original.pdf',
        mockAnalysis,
        '/output/dir'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        invoiceNumber: 1,
        pages: [1, 2],
        pdfPath: '/output/dir/invoice_1.pdf',
        fileName: 'invoice_1.pdf',
        fileSize: 4,
      });
      expect(result[1]).toEqual({
        invoiceNumber: 2,
        pages: [3, 4],
        pdfPath: '/output/dir/invoice_2.pdf',
        fileName: 'invoice_2.pdf',
        fileSize: 4,
      });
    });

    it('should read original PDF file', async () => {
      await service.createSplitPdfFiles('/path/to/original.pdf', mockAnalysis, '/output/dir');

      expect(fs.readFile).toHaveBeenCalledWith('/path/to/original.pdf');
      expect(PDFDocument.load).toHaveBeenCalled();
    });

    it('should create new PDF for each group', async () => {
      await service.createSplitPdfFiles('/path/to/original.pdf', mockAnalysis, '/output/dir');

      expect(PDFDocument.create).toHaveBeenCalledTimes(2);
    });

    it('should copy correct pages for each group', async () => {
      await service.createSplitPdfFiles('/path/to/original.pdf', mockAnalysis, '/output/dir');

      expect(mockPdfDocument.copyPages).toHaveBeenCalledWith(
        expect.anything(),
        [0, 1] // Pages 1,2 -> indices 0,1
      );
      expect(mockPdfDocument.copyPages).toHaveBeenCalledWith(
        expect.anything(),
        [2, 3] // Pages 3,4 -> indices 2,3
      );
    });

    it('should write PDF files to output directory', async () => {
      await service.createSplitPdfFiles('/path/to/original.pdf', mockAnalysis, '/output/dir');

      expect(fs.writeFile).toHaveBeenCalledWith(
        '/output/dir/invoice_1.pdf',
        expect.any(Uint8Array)
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/output/dir/invoice_2.pdf',
        expect.any(Uint8Array)
      );
    });

    it('should handle single page groups', async () => {
      const singlePageAnalysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [5],
            confidence: 0.95,
            reasoning: 'Single page invoice',
          },
        ],
      };

      mockPdfDocument.copyPages.mockResolvedValue([{}]);

      const result = await service.createSplitPdfFiles(
        '/path/to/original.pdf',
        singlePageAnalysis,
        '/output/dir'
      );

      expect(result).toHaveLength(1);
      expect(result[0].pages).toEqual([5]);
      expect(mockPdfDocument.copyPages).toHaveBeenCalledWith(expect.anything(), [4]);
    });

    it('should handle errors during PDF creation', async () => {
      mockPdfDocument.save.mockRejectedValueOnce(new Error('PDF save failed'));

      const result = await service.createSplitPdfFiles(
        '/path/to/original.pdf',
        mockAnalysis,
        '/output/dir'
      );

      expect(result[0]).toEqual({
        invoiceNumber: 1,
        pages: [1, 2],
        pdfPath: '',
        fileName: '',
        fileSize: 0,
      });
    });

    it('should log progress', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.createSplitPdfFiles('/path/to/original.pdf', mockAnalysis, '/output/dir');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Creating 2 split PDF files'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Created split PDF'));
    });

    it('should log errors', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      mockPdfDocument.save.mockRejectedValue(new Error('Test error'));

      await service.createSplitPdfFiles('/path/to/original.pdf', mockAnalysis, '/output/dir');

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should handle empty page groups', async () => {
      const emptyAnalysis: PageAnalysisResult = {
        totalInvoices: 0,
        pageGroups: [],
      };

      const result = await service.createSplitPdfFiles(
        '/path/to/original.pdf',
        emptyAnalysis,
        '/output/dir'
      );

      expect(result).toEqual([]);
      expect(PDFDocument.create).not.toHaveBeenCalled();
    });
  });

  describe('validatePageAnalysis', () => {
    it('should validate correct page analysis', () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 2,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [1, 2, 3],
            confidence: 0.95,
            reasoning: 'Valid',
          },
          {
            invoiceNumber: 2,
            pages: [4, 5],
            confidence: 0.90,
            reasoning: 'Valid',
          },
        ],
      };

      expect(() => service.validatePageAnalysis(analysis, 10)).not.toThrow();
    });

    it('should throw error for invalid page numbers below 1', () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [0, 1, 2],
            confidence: 0.95,
            reasoning: 'Invalid',
          },
        ],
      };

      expect(() => service.validatePageAnalysis(analysis, 10)).toThrow(
        'Invalid page numbers detected: 0'
      );
    });

    it('should throw error for invalid page numbers above total', () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [1, 2, 11],
            confidence: 0.95,
            reasoning: 'Invalid',
          },
        ],
      };

      expect(() => service.validatePageAnalysis(analysis, 10)).toThrow(
        'Invalid page numbers detected: 11'
      );
    });

    it('should throw error for duplicate pages', () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 2,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [1, 2],
            confidence: 0.95,
            reasoning: 'Duplicate',
          },
          {
            invoiceNumber: 2,
            pages: [2, 3],
            confidence: 0.90,
            reasoning: 'Duplicate',
          },
        ],
      };

      expect(() => service.validatePageAnalysis(analysis, 10)).toThrow(
        'Duplicate pages detected in analysis'
      );
    });

    it('should handle edge case with single page', () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [1],
            confidence: 0.95,
            reasoning: 'Single page',
          },
        ],
      };

      expect(() => service.validatePageAnalysis(analysis, 1)).not.toThrow();
    });

    it('should handle maximum page number', () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [10],
            confidence: 0.95,
            reasoning: 'Max page',
          },
        ],
      };

      expect(() => service.validatePageAnalysis(analysis, 10)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle large PDF with many pages', async () => {
      const manyPagesAnalysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: Array.from({ length: 100 }, (_, i) => i + 1),
            confidence: 0.95,
            reasoning: 'Large PDF',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('large pdf content'));
      mockPdfDocument.copyPages.mockResolvedValue(Array(100).fill({}));
      mockPdfDocument.save.mockResolvedValue(new Uint8Array(10000));
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createSplitPdfFiles(
        '/path/to/large.pdf',
        manyPagesAnalysis,
        '/output'
      );

      expect(result).toHaveLength(1);
      expect(result[0].pages).toHaveLength(100);
    });

    it('should handle file system errors', async () => {
      const analysis: PageAnalysisResult = {
        totalInvoices: 1,
        pageGroups: [
          {
            invoiceNumber: 1,
            pages: [1],
            confidence: 0.95,
            reasoning: 'Test',
          },
        ],
      };

      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(
        service.createSplitPdfFiles('/path/to/missing.pdf', analysis, '/output')
      ).rejects.toThrow('File not found');
    });
  });
});
