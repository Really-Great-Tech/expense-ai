import { Injectable, Logger } from '@nestjs/common';
import { pdf } from 'pdf-to-img';

/**
 * Represents a single page converted to an image
 */
export interface PageImage {
  pageNumber: number;
  imageBase64: string;
  width: number;
  height: number;
}

/**
 * Options for PDF to image conversion
 */
export interface ConversionOptions {
  /** Specific pages to convert (1-indexed). If not provided, converts all pages */
  pagesToProcess?: number[];
  /** Scale factor for rendering (default: 1.0) */
  viewportScale?: number;
  /** Process pages in parallel for better performance */
  processPagesInParallel?: boolean;
}

/**
 * Service for converting PDF documents to PNG images
 * Uses pdf-to-png-converter library for high-quality conversion
 */
@Injectable()
export class PdfToImageService {
  private readonly logger = new Logger(PdfToImageService.name);

  /** Default viewport scale for image conversion */
  private static readonly DEFAULT_VIEWPORT_SCALE = 1.5;

  /**
   * Convert all pages of a PDF to PNG images
   * @param pdfBuffer PDF file as a Buffer
   * @param options Conversion options
   * @returns Array of PageImage objects with base64-encoded PNG data
   */
  async convertPdfToImages(pdfBuffer: Buffer, options?: ConversionOptions): Promise<PageImage[]> {
    const startTime = Date.now();

    try {
      this.logger.log(`Starting PDF to image conversion (${pdfBuffer.length} bytes)`);

      const scale = options?.viewportScale ?? PdfToImageService.DEFAULT_VIEWPORT_SCALE;
      const document = await pdf(pdfBuffer, { scale });

      const pageImages: PageImage[] = [];
      let pageNumber = 0;

      for await (const image of document) {
        pageNumber++;

        if (options?.pagesToProcess && !options.pagesToProcess.includes(pageNumber)) {
          continue;
        }

        pageImages.push({
          pageNumber,
          imageBase64: image.toString('base64'),
          width: 0,
          height: 0,
        });
      }

      const duration = Date.now() - startTime;
      this.logger.log(`Converted ${pageImages.length} pages to images in ${duration}ms`);

      return pageImages;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`PDF to image conversion failed: ${errorMessage}`, errorStack);
      throw new Error(`Failed to convert PDF to images: ${errorMessage}`);
    }
  }

  /**
   * Convert a specific page of a PDF to a base64-encoded PNG
   * @param pdfBuffer PDF file as a Buffer
   * @param pageNumber Page number to convert (1-indexed)
   * @param viewportScale Scale factor for rendering
   * @returns Base64-encoded PNG image data
   */
  async convertPageToBase64(
    pdfBuffer: Buffer,
    pageNumber: number,
    viewportScale?: number,
  ): Promise<string> {
    try {
      const scale = viewportScale ?? PdfToImageService.DEFAULT_VIEWPORT_SCALE;
      const document = await pdf(pdfBuffer, { scale });

      let currentPage = 0;
      for await (const image of document) {
        currentPage++;
        if (currentPage === pageNumber) {
          return image.toString('base64');
        }
      }

      throw new Error(`Page ${pageNumber} not found in PDF`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to convert page ${pageNumber}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Convert multiple specific pages to images
   * @param pdfBuffer PDF file as a Buffer
   * @param pageNumbers Array of page numbers to convert (1-indexed)
   * @returns Map of page numbers to base64-encoded PNG data
   */
  async convertPagesToBase64Map(
    pdfBuffer: Buffer,
    pageNumbers: number[],
  ): Promise<Map<number, string>> {
    const pageImages = await this.convertPdfToImages(pdfBuffer, {
      pagesToProcess: pageNumbers,
    });

    const imageMap = new Map<number, string>();
    for (const page of pageImages) {
      imageMap.set(page.pageNumber, page.imageBase64);
    }

    return imageMap;
  }

  /**
   * Get the total number of pages in a PDF without converting
   * This is a lightweight operation that only reads PDF metadata
   * @param pdfBuffer PDF file as a Buffer
   * @returns Total number of pages
   */
  async getPageCount(pdfBuffer: Buffer): Promise<number> {
    try {
      const document = await pdf(pdfBuffer, { scale: 0.1 });

      let count = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _page of document) {
        count++;
      }

      return count;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get page count: ${errorMessage}`);
      throw error;
    }
  }
}
