import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentReaderFactory } from '@/utils/documentReaderFactory';
import { PageMarkdown } from '../types/document-splitter.types';

@Injectable()
export class DocumentParsingService {
  private readonly logger = new Logger(DocumentParsingService.name);

  constructor(private readonly configService: ConfigService) {}

  async extractFullDocumentMarkdown(pdfPath: string, documentReader: string): Promise<string> {
    this.logger.log(`Extracting full document as markdown using ${documentReader}`);

    try {
      const reader = DocumentReaderFactory.getDefaultReader(this.configService, documentReader);

      const parseConfig = {
        featureTypes: ['TABLES', 'FORMS'],
        outputFormat: 'markdown' as const,
        timeout: 120000,
      };

      const parseResult = await reader.parseDocument(pdfPath, parseConfig);

      if (parseResult.success && parseResult.data) {
        this.logger.log(`Successfully extracted full document (${parseResult.data.length} characters)`);
        return parseResult.data;
      } else {
        const errorMsg = 'error' in parseResult ? parseResult.error : 'Unknown error';
        this.logger.error(`Failed to parse document: ${pdfPath} - ${errorMsg}`);
        throw new Error(`Document parsing failed: ${errorMsg}`);
      }
    } catch (error) {
      this.logger.error(`Error parsing document ${pdfPath}:`, error);
      throw error;
    }
  }

  parseMarkdownPages(fullMarkdown: string): PageMarkdown[] {
    this.logger.log('Parsing markdown content into page structures');

    const pages: PageMarkdown[] = [];
    const pageRegex = /^## Page (\d+)$/gm;
    const matches = [...fullMarkdown.matchAll(pageRegex)];

    if (matches.length === 0) {
      this.logger.warn('No page markers found in markdown, treating as single page');
      return [
        {
          pageNumber: 1,
          content: fullMarkdown,
          filePath: '',
        },
      ];
    }

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const pageNumber = parseInt(match[1]);
      const startIndex = match.index! + match[0].length;

      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : fullMarkdown.length;

      const pageContent = fullMarkdown.substring(startIndex, endIndex).trim();

      if (pageContent.length > 0) {
        pages.push({
          pageNumber,
          content: pageContent,
          filePath: '',
        });

        this.logger.debug(`Parsed page ${pageNumber} (${pageContent.length} characters)`);
      }
    }

    this.logger.log(`Successfully parsed ${pages.length} pages from markdown`);
    return pages;
  }

  combinePageMarkdown(pageMarkdowns: PageMarkdown[], pageNumbers: number[]): string {
    return pageNumbers
      .map((pageNum) => {
        const page = pageMarkdowns.find((p) => p.pageNumber === pageNum);
        return page ? `# Page ${pageNum}\n\n${page.content}` : '';
      })
      .filter((content) => content.length > 0)
      .join('\n\n---\n\n');
  }
}
