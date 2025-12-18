import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DocumentParsingService } from './document-parsing.service';
import { DocumentReaderFactory } from '@/utils/documentReaderFactory';

jest.mock('@/utils/documentReaderFactory');

describe('DocumentParsingService', () => {
  let service: DocumentParsingService;
  let configService: ConfigService;
  let mockReader: any;

  beforeEach(async () => {
    mockReader = {
      parseDocument: jest.fn(),
    };

    (DocumentReaderFactory.getDefaultReader as jest.Mock) = jest.fn().mockReturnValue(mockReader);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentParsingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DocumentParsingService>(DocumentParsingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('extractFullDocumentMarkdown', () => {
    const mockPdfPath = '/path/to/document.pdf';
    const mockDocumentReader = 'textract';
    const mockMarkdownContent = '# Document\n\nContent here';

    it('should extract markdown successfully', async () => {
      mockReader.parseDocument.mockResolvedValue({
        success: true,
        data: mockMarkdownContent,
      });

      const result = await service.extractFullDocumentMarkdown(mockPdfPath, mockDocumentReader);

      expect(DocumentReaderFactory.getDefaultReader).toHaveBeenCalledWith(configService, mockDocumentReader);
      expect(mockReader.parseDocument).toHaveBeenCalledWith(mockPdfPath, {
        featureTypes: ['TABLES', 'FORMS'],
        outputFormat: 'markdown',
        timeout: 120000,
      });
      expect(result).toBe(mockMarkdownContent);
    });

    it('should handle parsing failure', async () => {
      mockReader.parseDocument.mockResolvedValue({
        success: false,
        error: 'Parse error occurred',
      });

      await expect(service.extractFullDocumentMarkdown(mockPdfPath, mockDocumentReader)).rejects.toThrow(
        'Document parsing failed: Parse error occurred',
      );
    });

    it('should handle parsing exception', async () => {
      mockReader.parseDocument.mockRejectedValue(new Error('Network error'));

      await expect(service.extractFullDocumentMarkdown(mockPdfPath, mockDocumentReader)).rejects.toThrow('Network error');
    });

    it('should log extraction progress', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      mockReader.parseDocument.mockResolvedValue({
        success: true,
        data: mockMarkdownContent,
      });

      await service.extractFullDocumentMarkdown(mockPdfPath, mockDocumentReader);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Extracting full document'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully extracted'));
    });

    it('should log errors on failure', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      mockReader.parseDocument.mockRejectedValue(new Error('Test error'));

      await expect(service.extractFullDocumentMarkdown(mockPdfPath, mockDocumentReader)).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('parseMarkdownPages', () => {
    it('should parse markdown with multiple pages', () => {
      const fullMarkdown = `## Page 1
Content for page 1

## Page 2
Content for page 2

## Page 3
Content for page 3`;

      const pages = service.parseMarkdownPages(fullMarkdown);

      expect(pages).toHaveLength(3);
      expect(pages[0]).toEqual({
        pageNumber: 1,
        content: 'Content for page 1',
        filePath: '',
      });
      expect(pages[1]).toEqual({
        pageNumber: 2,
        content: 'Content for page 2',
        filePath: '',
      });
      expect(pages[2]).toEqual({
        pageNumber: 3,
        content: 'Content for page 3',
        filePath: '',
      });
    });

    it('should handle markdown without page markers', () => {
      const fullMarkdown = 'Single page content without markers';

      const pages = service.parseMarkdownPages(fullMarkdown);

      expect(pages).toHaveLength(1);
      expect(pages[0]).toEqual({
        pageNumber: 1,
        content: fullMarkdown,
        filePath: '',
      });
    });

    it('should handle empty pages correctly', () => {
      const fullMarkdown = `## Page 1
Content for page 1

## Page 2

## Page 3
Content for page 3`;

      const pages = service.parseMarkdownPages(fullMarkdown);

      expect(pages).toHaveLength(2); // Page 2 is empty and should be excluded
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[1].pageNumber).toBe(3);
    });

    it('should trim whitespace from page content', () => {
      const fullMarkdown = `## Page 1
   Content with leading spaces   

## Page 2
Content with trailing spaces   `;

      const pages = service.parseMarkdownPages(fullMarkdown);

      expect(pages[0].content).toBe('Content with leading spaces');
      expect(pages[1].content).toBe('Content with trailing spaces');
    });

    it('should handle complex markdown with formatting', () => {
      const fullMarkdown = `## Page 1
# Header
- List item 1
- List item 2

**Bold text**

## Page 2
| Table | Header |
|-------|--------|
| Cell  | Data   |`;

      const pages = service.parseMarkdownPages(fullMarkdown);

      expect(pages).toHaveLength(2);
      expect(pages[0].content).toContain('# Header');
      expect(pages[0].content).toContain('**Bold text**');
      expect(pages[1].content).toContain('| Table | Header |');
    });

    it('should log parsing progress', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');
      const markdown = '## Page 1\nContent';

      service.parseMarkdownPages(markdown);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Parsing markdown content'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully parsed'));
    });

    it('should warn when no page markers found', () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');
      const markdown = 'Content without markers';

      service.parseMarkdownPages(markdown);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No page markers found'));
    });
  });

  describe('combinePageMarkdown', () => {
    const mockPages = [
      { pageNumber: 1, content: 'Content from page 1', filePath: '' },
      { pageNumber: 2, content: 'Content from page 2', filePath: '' },
      { pageNumber: 3, content: 'Content from page 3', filePath: '' },
    ];

    it('should combine sequential pages', () => {
      const result = service.combinePageMarkdown(mockPages, [1, 2, 3]);

      expect(result).toContain('# Page 1');
      expect(result).toContain('Content from page 1');
      expect(result).toContain('# Page 2');
      expect(result).toContain('Content from page 2');
      expect(result).toContain('# Page 3');
      expect(result).toContain('Content from page 3');
      expect(result).toContain('---'); // Separator
    });

    it('should combine non-sequential pages', () => {
      const result = service.combinePageMarkdown(mockPages, [1, 3]);

      expect(result).toContain('# Page 1');
      expect(result).toContain('# Page 3');
      expect(result).not.toContain('# Page 2');
    });

    it('should handle single page', () => {
      const result = service.combinePageMarkdown(mockPages, [2]);

      expect(result).toBe('# Page 2\n\nContent from page 2');
      expect(result).not.toContain('---');
    });

    it('should handle empty page numbers', () => {
      const result = service.combinePageMarkdown(mockPages, []);

      expect(result).toBe('');
    });

    it('should skip non-existent page numbers', () => {
      const result = service.combinePageMarkdown(mockPages, [1, 99, 3]);

      expect(result).toContain('# Page 1');
      expect(result).toContain('# Page 3');
      expect(result).not.toContain('# Page 99');
    });

    it('should handle pages in different order', () => {
      const result = service.combinePageMarkdown(mockPages, [3, 1, 2]);

      const page3Index = result.indexOf('# Page 3');
      const page1Index = result.indexOf('# Page 1');
      const page2Index = result.indexOf('# Page 2');

      expect(page3Index).toBeLessThan(page1Index);
      expect(page1Index).toBeLessThan(page2Index);
    });

    it('should format pages consistently', () => {
      const result = service.combinePageMarkdown(mockPages, [1, 2]);

      const lines = result.split('\n');
      expect(lines[0]).toBe('# Page 1');
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('Content from page 1');
    });
  });

  describe('edge cases', () => {
    it('should handle very large markdown documents', async () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      mockReader.parseDocument.mockResolvedValue({
        success: true,
        data: largeContent,
      });

      const result = await service.extractFullDocumentMarkdown('/test.pdf', 'textract');

      expect(result).toBe(largeContent);
      expect(result.length).toBe(1000000);
    });

    it('should handle markdown with many pages', () => {
      let markdown = '';
      for (let i = 1; i <= 100; i++) {
        markdown += `## Page ${i}\nContent ${i}\n\n`;
      }

      const pages = service.parseMarkdownPages(markdown);

      expect(pages).toHaveLength(100);
      expect(pages[0].pageNumber).toBe(1);
      expect(pages[99].pageNumber).toBe(100);
    });

    it('should handle special characters in content', () => {
      const markdown = `## Page 1
Content with special chars: < > & " ' \`
${'\u0000'} null char`;

      const pages = service.parseMarkdownPages(markdown);

      expect(pages[0].content).toContain('special chars');
    });
  });
});
