import { robustFetch } from './robustFetch';
import { z } from 'zod';

// Mock global fetch
global.fetch = jest.fn();

describe('robustFetch', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
  });

  describe('successful requests', () => {
    it('should make successful GET request', async () => {
      const mockData = { message: 'success' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      const result = await robustFetch({
        url: 'https://api.example.com/data',
      });

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'GET',
        headers: {},
      });
    });

    it('should make successful POST request with JSON body', async () => {
      const requestBody = { name: 'test' };
      const mockData = { id: 1, ...requestBody };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      const result = await robustFetch({
        url: 'https://api.example.com/create',
        method: 'POST',
        body: requestBody,
      });

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    });

    it('should make request with FormData body', async () => {
      const formData = new FormData();
      formData.append('file', 'test-file');
      const mockData = { uploaded: true };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      const result = await robustFetch({
        url: 'https://api.example.com/upload',
        method: 'POST',
        body: formData,
      });

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/upload', {
        method: 'POST',
        headers: {},
        body: formData,
      });
    });

    it('should include custom headers', async () => {
      const mockData = { message: 'success' };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      await robustFetch({
        url: 'https://api.example.com/data',
        headers: { 'Authorization': 'Bearer token123' },
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer token123' },
      });
    });
  });

  describe('schema validation', () => {
    it('should validate response with schema', async () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });
      const mockData = { id: 1, name: 'test' };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      const result = await robustFetch({
        url: 'https://api.example.com/data',
        schema,
      });

      expect(result).toEqual(mockData);
    });

    it('should throw error when schema validation fails', async () => {
      const schema = z.object({
        id: z.number(),
        name: z.string(),
      });
      const invalidData = { id: 'not-a-number', name: 'test' };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(invalidData),
      } as Response);

      await expect(
        robustFetch({
          url: 'https://api.example.com/data',
          schema,
        })
      ).rejects.toThrow('Schema validation failed');
    });
  });

  describe('error handling', () => {
    it('should throw error for non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ error: 'Not found' }),
      } as Response);

      await expect(
        robustFetch({
          url: 'https://api.example.com/missing',
        })
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should throw error for invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'not valid json',
      } as Response);

      await expect(
        robustFetch({
          url: 'https://api.example.com/data',
        })
      ).rejects.toThrow('Invalid JSON response');
    });

    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ message: 'success' }),
        } as Response);

      const result = await robustFetch({
        url: 'https://api.example.com/data',
        tryCount: 3,
        tryCooldown: 10,
      });

      expect(result).toEqual({ message: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after all retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        robustFetch({
          url: 'https://api.example.com/data',
          tryCount: 3,
          tryCooldown: 10,
        })
      ).rejects.toThrow('Network error');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValue('string error');

      await expect(
        robustFetch({
          url: 'https://api.example.com/data',
          tryCount: 1,
        })
      ).rejects.toThrow('string error');
    });

    it('should throw generic error if no error was captured', async () => {
      // This is an edge case that shouldn't normally happen
      mockFetch.mockImplementation(() => {
        throw null;
      });

      await expect(
        robustFetch({
          url: 'https://api.example.com/data',
          tryCount: 1,
        })
      ).rejects.toThrow();
    });

    it('should handle HTTP 500 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'Server error' }),
      } as Response);

      await expect(
        robustFetch({
          url: 'https://api.example.com/data',
        })
      ).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('different HTTP methods', () => {
    it('should support PUT method', async () => {
      const mockData = { updated: true };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      await robustFetch({
        url: 'https://api.example.com/update',
        method: 'PUT',
        body: { name: 'updated' },
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'updated' }),
      });
    });

    it('should support DELETE method', async () => {
      const mockData = { deleted: true };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockData),
      } as Response);

      await robustFetch({
        url: 'https://api.example.com/delete/1',
        method: 'DELETE',
      });

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/delete/1', {
        method: 'DELETE',
        headers: {},
      });
    });
  });
});
