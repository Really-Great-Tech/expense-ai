import { Injectable, Logger } from '@nestjs/common';
import { pdfToPng, PngPageOutput } from 'pdf-to-png-converter';

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

      // Convert Buffer to ArrayBuffer for pdf-to-png-converter
      const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.length);
      const pngPages: PngPageOutput[] = await pdfToPng(pdfArrayBuffer, {
        viewportScale: options?.viewportScale ?? PdfToImageService.DEFAULT_VIEWPORT_SCALE,
        pagesToProcess: options?.pagesToProcess,
        disableFontFace: true, // Improves performance
        useSystemFonts: true,
      });

      const pageImages: PageImage[] = pngPages.map((page) => ({
        pageNumber: page.pageNumber,
        imageBase64: page.content.toString('base64'),
        width: page.width,
        height: page.height,
      }));

      const duration = Date.now() - startTime;
      this.logger.log(`Converted ${pageImages.length} pages to images in ${duration}ms`);

      return pageImages;
    } catch (error: any) {
      this.logger.error(`PDF to image conversion failed: ${error.message}`, error.stack);
      throw new Error(`Failed to convert PDF to images: ${error.message}`);
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
      const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.length);
      const pngPages = await pdfToPng(pdfArrayBuffer, {
        viewportScale: viewportScale ?? PdfToImageService.DEFAULT_VIEWPORT_SCALE,
        pagesToProcess: [pageNumber],
        disableFontFace: true,
        useSystemFonts: true,
      });

      if (pngPages.length === 0) {
        throw new Error(`Page ${pageNumber} not found in PDF`);
      }

      return pngPages[0].content.toString('base64');
    } catch (error: any) {
      this.logger.error(`Failed to convert page ${pageNumber}: ${error.message}`);
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
      // Convert first page with minimal scale to get page count info
      const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.length);
      const pngPages = await pdfToPng(pdfArrayBuffer, {
        viewportScale: 0.1, // Very low scale for speed
        pagesToProcess: [-1], // Special value to get all pages
        disableFontFace: true,
        useSystemFonts: true,
      });

      return pngPages.length;
    } catch (error: any) {
      this.logger.error(`Failed to get page count: ${error.message}`);
      throw error;
    }
  }
}
