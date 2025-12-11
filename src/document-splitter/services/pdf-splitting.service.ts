import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PageAnalysisResult, SplitPdfInfo } from '../types/document-splitter.types';

@Injectable()
export class PdfSplittingService {
  private readonly logger = new Logger(PdfSplittingService.name);

  async createSplitPdfFiles(originalPdfPath: string, analysis: PageAnalysisResult, outputDir: string): Promise<SplitPdfInfo[]> {
    this.logger.log(`Creating ${analysis.totalInvoices} split PDF files`);

    const pdfBuffer = await fs.readFile(originalPdfPath);
    // Load with ignoreEncryption to handle more PDF types
    const originalPdf = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const splitPdfs: SplitPdfInfo[] = [];

    for (const group of analysis.pageGroups) {
      try {
        const newPdf = await PDFDocument.create();

        const pageIndices = group.pages.map((pageNum) => pageNum - 1);
        const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);

        copiedPages.forEach((page) => newPdf.addPage(page));

        const outputFileName = `invoice_${group.invoiceNumber}.pdf`;
        const outputPath = path.join(outputDir, outputFileName);
        // Save with compatibility options for AWS Textract
        // - useObjectStreams: false - Creates PDF 1.4 compatible structure (better Textract support)
        // - addDefaultPage: false - Don't add empty pages
        const pdfBytes = await newPdf.save({
          useObjectStreams: false,
          addDefaultPage: false,
        });
        await fs.writeFile(outputPath, pdfBytes);

        splitPdfs.push({
          invoiceNumber: group.invoiceNumber,
          pages: group.pages,
          pdfPath: outputPath,
          fileName: outputFileName,
          fileSize: pdfBytes.length,
        });

        this.logger.log(`Created split PDF: ${outputPath} (${group.pages.length} pages, ${pdfBytes.length} bytes)`);
      } catch (error) {
        this.logger.error(`Failed to create split PDF for invoice ${group.invoiceNumber}:`, error);

        splitPdfs.push({
          invoiceNumber: group.invoiceNumber,
          pages: group.pages,
          pdfPath: '',
          fileName: '',
          fileSize: 0,
        });
      }
    }

    return splitPdfs;
  }

  validatePageAnalysis(analysis: PageAnalysisResult, totalPages: number): void {
    const allPages = analysis.pageGroups.flatMap((g) => g.pages);
    const uniquePages = new Set(allPages);

    const invalidPages = allPages.filter((p) => p < 1 || p > totalPages);
    if (invalidPages.length > 0) {
      throw new Error(`Invalid page numbers detected: ${invalidPages.join(', ')}`);
    }

    if (allPages.length !== uniquePages.size) {
      throw new Error('Duplicate pages detected in analysis');
    }
  }
}
