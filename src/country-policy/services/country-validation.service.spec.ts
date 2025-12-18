import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CountryValidationService } from './country-validation.service';
import { Country } from '../entities/country.entity';

describe('CountryValidationService', () => {
  let service: CountryValidationService;
  let mockRepository: jest.Mocked<Repository<Country>>;

  const mockCountry: Country = {
    id: 1,
    name: 'Germany',
    code: 'DE',
    active: true,
    activePolicyId: null,
    activePolicy: null,
    versions: [],
    datasources: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    isCountryActive: () => true,
    getDisplayName: () => 'Germany (DE)',
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountryValidationService,
        {
          provide: getRepositoryToken(Country),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CountryValidationService>(CountryValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    service['validationCache'].clear();
  });

  describe('isValidCountry', () => {
    it('should return true for valid active country', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.isValidCountry('Germany');

      expect(result).toBe(true);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Germany', active: true },
      });
    });

    it('should return false for inactive country', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.isValidCountry('InvalidCountry');

      expect(result).toBe(false);
    });

    it('should return false for empty/null country name', async () => {
      const result1 = await service.isValidCountry('');
      const result2 = await service.isValidCountry(null as any);
      const result3 = await service.isValidCountry(undefined as any);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('should trim whitespace from country name', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      await service.isValidCountry('  Germany  ');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Germany', active: true },
      });
    });

    it('should use cache on subsequent calls', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      const result1 = await service.isValidCountry('Germany');
      const result2 = await service.isValidCountry('Germany');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should handle database errors gracefully', async () => {
      mockRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.isValidCountry('Germany');

      expect(result).toBe(false);
    });
  });
});
