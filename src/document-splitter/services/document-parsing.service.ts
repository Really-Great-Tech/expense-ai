import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { pdfToPng } from 'pdf-to-png-converter';
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

  /**
   * Convert PDF pages to base64 encoded images
   * @param pdfPath Path to the PDF file
   * @returns Array of base64 encoded PNG images (one per page)
   */
  async convertPdfToImages(pdfPath: string): Promise<string[]> {
    this.logger.log(`Converting PDF to images: ${pdfPath}`);

    try {
      const pdfBuffer = fs.readFileSync(pdfPath);
      const arrayBuffer = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength,
      );

      const pages = await pdfToPng(arrayBuffer as ArrayBuffer, {
        disableFontFace: false,
        useSystemFonts: true,
        viewportScale: 1.5, // Balance quality and size
      });

      const images = pages.map((page) => {
        if (page.content) {
          return page.content.toString('base64');
        }
        return '';
      });

      this.logger.log(`Converted ${images.length} pages to images`);
      return images;
    } catch (error) {
      this.logger.error(`Failed to convert PDF to images: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse markdown and add images to page structures
   * @param fullMarkdown Full markdown content
   * @param images Optional array of base64 images (one per page)
   */
  parseMarkdownPagesWithImages(fullMarkdown: string, images: string[] = []): PageMarkdown[] {
    const pages = this.parseMarkdownPages(fullMarkdown);

    // Add images to pages if available
    for (let i = 0; i < pages.length; i++) {
      if (images[i]) {
        pages[i].imageBase64 = images[i];
      }
    }

    this.logger.log(`Parsed ${pages.length} pages with ${images.filter(Boolean).length} images`);
    return pages;
  }
}
