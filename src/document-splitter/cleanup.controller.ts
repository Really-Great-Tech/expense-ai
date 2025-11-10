import {
  Controller,
  Delete,
  Param,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DocumentSplitterService } from './document-splitter.service';

@ApiTags('Cleanup')
@Controller('expenses/multi-receipt')
export class CleanupController {
  private readonly logger = new Logger(CleanupController.name);

  constructor(
    private readonly documentSplitterService: DocumentSplitterService,
  ) {}

  @Delete('cleanup/:tempDirectory')
  @ApiOperation({
    summary: 'Clean Up Temporary Split Files',
    description: `
**Remove temporary PDF files created during multi-expense splitting.**

After downloading or processing the split expense files, use this endpoint to clean up the temporary storage.

**Important:**
- Call this endpoint after you've downloaded all the split files
- The tempDirectory value is returned in the upload response
- Files are automatically cleaned up after 24 hours if not manually deleted
- This helps free up server storage space
    `,
  })
  @ApiParam({
    name: 'tempDirectory',
    description: '📁 Temporary directory timestamp (from upload response tempDirectory field)',
    example: '1640995200000',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Temporary files cleaned up successfully',
    schema: {
      example: {
        success: true,
        message: 'Temporary expense files cleaned up successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '❌ Invalid directory parameter or path traversal attempt',
    schema: {
      example: {
        success: false,
        message: 'Invalid temp directory parameter',
        statusCode: 400,
      },
    },
  })
  async cleanupTempFiles(@Param('tempDirectory') tempDirectory: string) {
    if (!tempDirectory || tempDirectory.includes('..') || tempDirectory.includes('/')) {
      throw new HttpException('Invalid temp directory parameter', HttpStatus.BAD_REQUEST);
    }

    try {
      // Reconstruct full temp directory path
      const fullTempPath = `uploads/invoice-splits/${tempDirectory}`;
      await this.documentSplitterService.cleanupTempFiles(fullTempPath);

      return {
        success: true,
        message: 'Temporary files cleaned up successfully',
      };
    } catch (error) {
      throw new HttpException(`Cleanup failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
