import { DataExtractionAgent } from './data-extraction.agent';
import { BedrockLlmService } from '../utils/bedrockLlm';

jest.mock('../utils/bedrockLlm');

describe('DataExtractionAgent', () => {
  let agent: DataExtractionAgent;
  let mockLlmService: jest.Mocked<BedrockLlmService>;

  beforeEach(() => {
    mockLlmService = {
      chat: jest.fn(),
      getCurrentProvider: jest.fn().mockReturnValue('bedrock'),
      getCurrentModelName: jest.fn().mockReturnValue('eu.amazon.nova-pro-v1:0'),
    } as any;

    agent = new DataExtractionAgent('bedrock');
    agent['llm'] = mockLlmService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractData', () => {
    const validExtractionResponse = {
      vendor_name: 'Restaurant ABC',
      total_amount: 45.5,
      currency: 'USD',
      date_of_issue: '2024-01-15',
      transaction_time: '18:30:00',
      payment_method: 'Credit Card',
      line_items: [
        {
          description: 'Burger',
          quantity: 2,
          unit_price: 15.0,
          total_price: 30.0,
        },
        {
          description: 'Drink',
          quantity: 2,
          unit_price: 7.75,
          total_price: 15.5,
        },
      ],
      tax_amount: 4.05,
      tax_rate: 9.0,
      subtotal: 41.45,
      notes: 'Thank you for dining with us',
    };

    it('should successfully extract data from receipt', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validExtractionResponse) },
        usage: { input_tokens: 200, output_tokens: 100 },
      });

      const markdownContent = `
        Restaurant ABC
        Date: 2024-01-15
        Time: 18:30

        2x Burger @ $15.00 = $30.00
        2x Drink @ $7.75 = $15.50

        Subtotal: $41.45
        Tax (9%): $4.05
        Total: $45.50

        Paid: Credit Card
      `;

      const result = await agent.extractData(markdownContent);

      expect(result.vendor_name).toBe('Restaurant ABC');
      expect(result.total_amount).toBe(45.5);
      expect(result.line_items).toHaveLength(2);
      expect(mockLlmService.chat).toHaveBeenCalledTimes(1);
    });

    it('should handle minimal data extraction', async () => {
      const minimalResponse = {
        vendor_name: 'Store XYZ',
        total_amount: 19.99,
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(minimalResponse) },
      });

      const result = await agent.extractData('Store XYZ - Total: $19.99');

      expect(result.vendor_name).toBe('Store XYZ');
      expect(result.total_amount).toBe(19.99);
    });

    it('should handle markdown code blocks in response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: '```json\n' + JSON.stringify(validExtractionResponse) + '\n```',
        },
      });

      const result = await agent.extractData('Receipt text');

      expect(result.vendor_name).toBe('Restaurant ABC');
    });

    it('should handle Anthropic array format response', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: {
          content: [{ type: 'text', text: JSON.stringify(validExtractionResponse) }],
        },
      } as any);

      const result = await agent.extractData('Receipt text');

      expect(result.vendor_name).toBe('Restaurant ABC');
      expect(result.line_items).toBeDefined();
    });

    it('should return fallback result on LLM error', async () => {
      mockLlmService.chat.mockRejectedValue(new Error('Service timeout'));

      const result = await agent.extractData('Receipt text');

      expect(result.vendor_name).toBe('extraction_failed');
      expect(result.notes).toContain('Service timeout');
    });

    it('should return fallback result on invalid JSON', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: 'Not valid JSON' },
      });

      const result = await agent.extractData('Receipt text');

      expect(result.vendor_name).toBe('extraction_failed');
      expect(result.notes).toContain('Error');
    });

    it('should extract complex line items', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validExtractionResponse) },
      });

      const result = await agent.extractData('Receipt with multiple items');

      expect(result.line_items).toHaveLength(2);
      expect(result.line_items[0]).toHaveProperty('description');
      expect(result.line_items[0]).toHaveProperty('quantity');
      expect(result.line_items[0]).toHaveProperty('unit_price');
      expect(result.line_items[0]).toHaveProperty('total_price');
    });

    it('should handle receipts with tax information', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validExtractionResponse) },
      });

      const result = await agent.extractData('Receipt with tax');

      expect(result.tax_amount).toBe(4.05);
      expect(result.tax_rate).toBe(9.0);
      expect(result.subtotal).toBe(41.45);
    });

    it('should extract payment method', async () => {
      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(validExtractionResponse) },
      });

      const result = await agent.extractData('Receipt');

      expect(result.payment_method).toBe('Credit Card');
    });

    it('should handle receipts with special characters', async () => {
      const specialCharResponse = {
        vendor_name: 'Café François',
        total_amount: 25.5,
        currency: 'EUR',
        notes: 'Merci beaucoup! À bientôt',
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(specialCharResponse) },
      });

      const result = await agent.extractData('Café receipt');

      expect(result.vendor_name).toBe('Café François');
      expect(result.notes).toContain('Merci');
    });
  });

  describe('getActualModelUsed', () => {
    it('should return model name from Bedrock service', () => {
      const modelName = agent.getActualModelUsed();
      expect(modelName).toBe('eu.amazon.nova-pro-v1:0');
    });

    it('should fallback to defaultModelId when getCurrentModelName not available', () => {
      agent['llm'] = { getCurrentModelName: undefined } as any;
      const modelName = agent.getActualModelUsed();
      expect(modelName).toBe('eu.amazon.nova-pro-v1:0');
    });
  });

  describe('constructor', () => {
    it('should initialize with default provider and model', () => {
      const newAgent = new DataExtractionAgent();
      expect(newAgent['currentProvider']).toBe('bedrock');
      expect(newAgent['defaultModelId']).toBeDefined();
    });

    it('should accept custom model ID', () => {
      const customModel = 'custom-model-id';
      const newAgent = new DataExtractionAgent('bedrock', customModel);
      expect(newAgent['defaultModelId']).toBe(customModel);
    });
  });

  describe('Integration: Full extraction workflow', () => {
    it('should extract all fields from complete receipt', async () => {
      const fullValidResponse = {
        vendor_name: 'Restaurant ABC',
        total_amount: 45.5,
        currency: 'USD',
        date_of_issue: '2024-01-15',
        transaction_time: '18:30:00',
        payment_method: 'Credit Card',
        line_items: [
          {
            description: 'Burger',
            quantity: 2,
            unit_price: 15.0,
            total_price: 30.0,
          },
          {
            description: 'Drink',
            quantity: 2,
            unit_price: 7.75,
            total_price: 15.5,
          },
        ],
        tax_amount: 4.05,
        tax_rate: 9.0,
        subtotal: 41.45,
        notes: 'Thank you for dining with us',
      };

      mockLlmService.chat.mockResolvedValue({
        message: { content: JSON.stringify(fullValidResponse) },
        usage: { input_tokens: 300, output_tokens: 150 },
      });

      const completeReceipt = `
        RESTAURANT ABC
        123 Main St, City
        Phone: (555) 123-4567

        Receipt #: 001234
        Date: January 15, 2024
        Time: 6:30 PM
        Server: John

        ORDER:
        2x Classic Burger        $15.00    $30.00
        2x Soft Drink           $7.75     $15.50

        Subtotal:               $41.45
        Tax (9%):               $4.05
        -----------------------------
        TOTAL:                  $45.50

        Payment Method: Credit Card
        Card: ****1234

        Thank you for dining with us!
      `;

      const result = await agent.extractData(completeReceipt);

      // Verify all key fields extracted
      expect(result.vendor_name).toBeTruthy();
      expect(result.total_amount).toBeGreaterThan(0);
      expect(result.date_of_issue).toBeTruthy();
      expect(result.line_items).toBeDefined();
      expect(Array.isArray(result.line_items)).toBe(true);
      expect(result.payment_method).toBeTruthy();

      // Verify calculations
      if (result.subtotal && result.tax_amount && result.total_amount) {
        expect(result.subtotal + result.tax_amount).toBeCloseTo(result.total_amount, 2);
      }
    });
  });
});
