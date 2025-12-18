import { Injectable, Logger } from '@nestjs/common';

export interface PageCountResult {
  isValid: boolean;
  pageCount: number;
  maxPages: number;
  error?: string;
}

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);
  private readonly MAX_PAGES = 20;

  async validatePageCount(file: Express.Multer.File): Promise<PageCountResult> {
    const result: PageCountResult = {
      isValid: true,
      pageCount: 0,
      maxPages: this.MAX_PAGES,
    };

    try {
      if (file.mimetype === 'application/pdf') {
        result.pageCount = await this.countPdfPages(file.buffer);
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        result.pageCount = await this.countDocxPages(file.buffer);
      } else {
        // For images and other types, assume 1 page
        result.pageCount = 1;
        return result;
      }

      if (result.pageCount > this.MAX_PAGES) {
        result.isValid = false;
        result.error = `Document has ${result.pageCount} pages, maximum allowed is ${this.MAX_PAGES} pages`;
        this.logger.warn(`Page count validation failed for ${file.originalname}: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Page count validation error for ${file.originalname}:`, error);
      // Don't block on page count errors - just log and continue
      result.pageCount = 0;
      return result;
    }
  }

  private async countPdfPages(buffer: Buffer): Promise<number> {
    // Simple PDF page counting using regex
    const pdfText = buffer.toString('latin1');
    const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  }

  private async countDocxPages(buffer: Buffer): Promise<number> {
    // Basic DOCX page estimation
    try {
      const docxText = buffer.toString('latin1');
      const pageBreaks = (docxText.match(/w:br[^>]*w:type="page"/g) || []).length;
      return Math.max(1, pageBreaks + 1); // At least 1 page
    } catch (error) {
      throw new Error(`Failed to parse DOCX structure: ${error.message}`);
    }
  }
}
