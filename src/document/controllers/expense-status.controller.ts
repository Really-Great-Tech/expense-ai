import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ExpenseStatusService } from '../services/expense-status.service';
import { ReceiptResultsQueryService } from '../services/receipt-results-query.service';

@ApiTags('Expense Status')
@Controller('expenses')
export class ExpenseStatusController {
  private readonly logger = new Logger(ExpenseStatusController.name);

  constructor(
    private expenseStatusService: ExpenseStatusService,
    private receiptResultsQuery: ReceiptResultsQueryService,
  ) {}

  /**
   * Get comprehensive status for an expense submission
   * Returns master-level status derived from child receipts
   * GET /api/v1/expenses/:expenseId/status
   */
  @Get(':expenseId/status')
  @ApiOperation({
    summary: 'Get Expense Status (Master Level)',
    description: `
**Get comprehensive status for an entire expense submission.**

This endpoint provides a **master-level view** that aggregates status from:
- 📄 Parent expense document (upload & splitting pipeline)
- 🧾 Child receipts (processing status for each individual receipt)

**Status Derivation Logic:**
- **SPLITTING**: Expense document is being uploaded/split into receipts
- **PROCESSING_RECEIPTS**: Receipts are queued or actively being processed
- **COMPLETED**: All receipts processed successfully ✅
- **PARTIALLY_COMPLETE**: Some receipts succeeded, some failed, none processing ⚠️
- **FAILED**: Document splitting failed OR all receipts failed ❌

**Key Feature**: The \`overallStatus\` is **derived in real-time** from child receipt states.
If no child receipt is actively processing (QUEUED/PROCESSING/etc), the master is considered
complete or partially complete. This handles cancelled/stopped jobs gracefully.

**Use Cases:**
- Dashboard showing "Is my expense submission done?"
- Progress bars for multi-receipt uploads
- Polling for completion before redirecting user
- Detecting stuck/cancelled processing jobs
    `,
  })
  @ApiParam({
    name: 'expenseId',
    description: 'UUID of the expense submission (ExpenseDocument ID)',
    example: 'e1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Expense status retrieved successfully',
    schema: {
      example: {
        expenseDocumentId: 'e1b2c3d4-5678-90ab-cdef-1234567890ab',
        originalFileName: 'march_receipts.pdf',
        documentStatus: 'COMPLETED',
        overallStatus: 'PROCESSING_RECEIPTS',
        progress: {
          uploadProgress: 100,
          processingProgress: 45,
          overallProgress: 61,
        },
        receipts: {
          total: 5,
          created: 0,
          queued: 1,
          processing: 2,
          completed: 1,
          failed: 1,
        },
        timestamps: {
          uploadedAt: '2025-03-15T10:00:00Z',
          splittingCompletedAt: '2025-03-15T10:02:30Z',
          processingStartedAt: '2025-03-15T10:02:45Z',
          processingCompletedAt: null,
        },
        metadata: {
          country: 'Germany',
          icp: 'Global People',
          uploadedBy: 'user_12345',
          totalPages: 7,
          totalReceipts: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Expense not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Expense document e1b2c3d4-5678-90ab-cdef-1234567890ab not found',
        error: 'Not Found',
      },
    },
  })
  async getExpenseStatus(@Param('expenseId') expenseId: string) {
    this.logger.log(`Fetching expense status for ${expenseId}`);

    try {
      return await this.expenseStatusService.getExpenseStatus(expenseId);
    } catch (error) {
      this.logger.error(`Failed to fetch expense status for ${expenseId}:`, error);
      throw error;
    }
  }

  /**
   * Get all receipt processing results for an expense
   * GET /api/v1/expenses/:expenseId/results
   */
  @Get(':expenseId/results')
  @ApiOperation({
    summary: 'Get All Receipt Results for Expense',
    description: `
**Get detailed processing results for all receipts in an expense submission.**

This endpoint returns:
- 📄 Expense document metadata (filename, country, ICP, upload info)
- 🎯 **overallStatus**: Derived status (SPLITTING, PROCESSING_RECEIPTS, COMPLETED, PARTIALLY_COMPLETE, FAILED)
- 🧾 Array of all child receipts with their processing status and compliance results
- 📊 Aggregate statistics (total, completed, failed, processing, queued)
- 📈 Overall progress percentage

**Each receipt includes:**
- Basic info (receiptId, fileName, fileSize, storageKey, status)
- Processing status and progress
- **results** object (only for completed receipts) containing:
  - extraction: All extracted receipt data
  - meta: Metadata (receiptId, timestamps, processing info)
  - issues: Unified list of compliance and image quality issues

**Difference from /expenses/:expenseId/status:**
- \`/status\` → Lightweight status check with overall state
- \`/results\` → Detailed breakdown with full compliance data for each receipt

**Use Cases:**
- Display list of all receipts with their compliance results
- Show which receipts have issues requiring attention
- Get complete extraction data for all receipts in one call
- Track per-receipt processing progress with detailed results
    `,
  })
  @ApiParam({
    name: 'expenseId',
    description: 'UUID of the expense submission (ExpenseDocument ID)',
    example: 'e1b2c3d4-5678-90ab-cdef-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Expense results retrieved successfully',
    schema: {
      example: {
        document: {
          id: 'e1b2c3d4-5678-90ab-cdef-1234567890ab',
          originalFileName: 'march_receipts.pdf',
          status: 'COMPLETED',
          totalReceipts: 5,
          country: 'Germany',
          icp: 'Global People',
          uploadedBy: 'user_12345',
          createdAt: '2025-03-15T10:00:00Z',
        },
        overallStatus: 'COMPLETED',
        receipts: [
          {
            receiptId: 'receipt_001',
            fileName: 'expense_1_restaurant.pdf',
            fileSize: 45823,
            storageKey: 'receipts/user_12345/doc_abc/expense_1_restaurant.pdf',
            status: 'COMPLETED',
            processingStatus: 'COMPLETED',
            processingProgress: 100,
            processingCompletedAt: '2025-03-15T10:03:30Z',
            hasResults: true,
            hasErrors: false,
            results: {
              extraction: {
                merchant_name: 'Restaurant ABC',
                total_amount: 45.50,
                currency: 'EUR',
                date: '2025-03-10',
              },
              meta: {
                receiptId: 'receipt_001',
                sourceDocumentId: 'e1b2c3d4-5678-90ab-cdef-1234567890ab',
                processingCompletedAt: '2025-03-15T10:03:30Z',
                processingTime: 12.5,
                processed_at: '2025-03-15T10:03:30Z',
              },
              issues: [
                {
                  index: 1,
                  issue_type: 'Missing Receipt Number',
                  field: 'receipt_number',
                  description: 'Receipt number is missing',
                  recommendation: 'Request receipt with number',
                  severity: 'medium',
                },
              ],
            },
          },
          {
            receiptId: 'receipt_002',
            fileName: 'expense_2_hotel.pdf',
            fileSize: 52341,
            storageKey: 'receipts/user_12345/doc_abc/expense_2_hotel.pdf',
            status: 'PROCESSING',
            processingStatus: 'EXTRACTION',
            processingProgress: 40,
            processingCompletedAt: null,
            hasResults: false,
            hasErrors: false,
            results: null,
          },
        ],
        overallProgress: 45,
        stats: {
          total: 5,
          completed: 1,
          failed: 1,
          processing: 2,
          queued: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: '❌ Expense not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Document e1b2c3d4-5678-90ab-cdef-1234567890ab not found',
        error: 'Not Found',
      },
    },
  })
  async getExpenseResults(@Param('expenseId') expenseId: string) {
    this.logger.log(`Fetching results for expense ${expenseId}`);

    try {
      return await this.receiptResultsQuery.getDocumentResults(expenseId);
    } catch (error) {
      this.logger.error(`Failed to fetch results for expense ${expenseId}:`, error);
      throw error;
    }
  }
}
