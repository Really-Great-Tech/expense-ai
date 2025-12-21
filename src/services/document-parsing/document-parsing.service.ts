import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentReaderFactory } from '@/utils/documentReaderFactory';
import { PageMarkdown } from '@/expense-document/types/upload.types';
import { PageImage } from '@/services/pdf-conversion/pdf-to-image.service';

@Injectable()
export class DocumentParsingService {
  private readonly logger = new Logger(DocumentParsingService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Extract full document markdown from buffer (preferred - no temp files)
   */
  async extractMarkdownFromBuffer(buffer: Buffer, fileName: string, documentReader: string): Promise<string> {
    this.logger.log(`Extracting markdown from buffer: ${fileName} (${buffer.length} bytes) using ${documentReader}`);

    try {
      const reader = DocumentReaderFactory.getDefaultReader(this.configService, documentReader);

      const parseConfig = {
        featureTypes: ['TABLES', 'FORMS'],
        outputFormat: 'markdown' as const,
        timeout: 120000,
      };

      // Use buffer-based parsing
      if (reader.parseDocumentFromBuffer) {
        const parseResult = await reader.parseDocumentFromBuffer(buffer, fileName, parseConfig);

        if (parseResult.success && parseResult.data) {
          this.logger.log(`Successfully extracted markdown from buffer (${parseResult.data.length} characters)`);
          return parseResult.data;
        } else {
          const errorMsg = 'error' in parseResult ? parseResult.error : 'Unknown error';
          this.logger.error(`Failed to parse document from buffer: ${fileName} - ${errorMsg}`);
          throw new Error(`Document parsing failed: ${errorMsg}`);
        }
      } else {
        throw new Error(`Document reader ${documentReader} does not support buffer-based parsing`);
      }
    } catch (error) {
      this.logger.error(`Error parsing document from buffer ${fileName}:`, error);
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
   * Parse markdown pages and merge with page images for vision analysis
   * @param fullMarkdown Full markdown content from document extraction
   * @param pageImages Array of page images from PDF conversion
   * @returns PageMarkdown array with imageBase64 populated for each page
   */
  parseMarkdownPagesWithImages(fullMarkdown: string, pageImages: PageImage[]): PageMarkdown[] {
    this.logger.log(`Parsing markdown with ${pageImages.length} images`);

    // First parse the markdown into pages
    const pages = this.parseMarkdownPages(fullMarkdown);

    // Create a map of page number to image for fast lookup
    const imageMap = new Map<number, string>();
    for (const img of pageImages) {
      imageMap.set(img.pageNumber, img.imageBase64);
    }

    // Merge images into pages
    for (const page of pages) {
      const imageBase64 = imageMap.get(page.pageNumber);
      if (imageBase64) {
        page.imageBase64 = imageBase64;
        this.logger.debug(`Added image to page ${page.pageNumber}`);
      }
    }

    const pagesWithImages = pages.filter((p) => p.imageBase64).length;
    this.logger.log(`Parsed ${pages.length} pages, ${pagesWithImages} with images`);

    return pages;
  }
}
