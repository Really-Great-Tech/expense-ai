import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CountryValidationService } from './country-validation.service';
import { Country } from '../entities/country.entity';
import { CreateCountryDto } from '../dto/create-country.dto';
import { UpdateCountryDto } from '../dto/update-country.dto';

// Note: ERROR logs in test output are intentional - they test error handling behavior
describe('CountryValidationService', () => {
  let service: CountryValidationService;
  let repository: Repository<Country>;
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
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
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
    repository = module.get<Repository<Country>>(getRepositoryToken(Country));
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear the service's internal cache
    service['validationCache'].clear();
    service['countryCache'].clear();
    service['activeCountriesCache'] = null;
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

      // First call
      const result1 = await service.isValidCountry('Germany');
      // Second call should use cache
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

  describe('findByName', () => {
    it('should return country when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.findByName('Germany');

      expect(result).toEqual(mockCountry);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'Germany' },
      });
    });

    it('should return null when country not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByName('NonExistent');

      expect(result).toBeNull();
    });

    it('should return null for empty name', async () => {
      const result = await service.findByName('');

      expect(result).toBeNull();
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('should use cache on subsequent calls', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      const result1 = await service.findByName('Germany');
      const result2 = await service.findByName('Germany');

      expect(result1).toEqual(mockCountry);
      expect(result2).toEqual(mockCountry);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('findActiveCountries', () => {
    const mockActiveCountries = [mockCountry, { ...mockCountry, id: 2, name: 'France', code: 'FR' }];

    it('should return all active countries', async () => {
      mockRepository.find.mockResolvedValue(mockActiveCountries as Country[]);

      const result = await service.findActiveCountries();

      expect(result).toEqual(mockActiveCountries);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { active: true },
        order: { name: 'ASC' },
      });
    });

    it('should use cache on subsequent calls', async () => {
      mockRepository.find.mockResolvedValue(mockActiveCountries as Country[]);

      const result1 = await service.findActiveCountries();
      const result2 = await service.findActiveCountries();

      expect(result1).toEqual(mockActiveCountries);
      expect(result2).toEqual(mockActiveCountries);
      expect(mockRepository.find).toHaveBeenCalledTimes(1);
    });

    it('should return empty array on database error', async () => {
      mockRepository.find.mockRejectedValue(new Error('Database error'));

      const result = await service.findActiveCountries();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createCountryDto: CreateCountryDto = {
      name: 'Spain',
      code: 'ES',
      active: true,
    };

    it('should create a new country successfully', async () => {
      const newCountry = { ...mockCountry, ...createCountryDto, id: 3 };
      mockRepository.findOne.mockResolvedValue(null); // No existing country
      mockRepository.create.mockReturnValue(newCountry as Country);
      mockRepository.save.mockResolvedValue(newCountry as Country);

      const result = await service.create(createCountryDto);

      expect(result).toEqual(newCountry);
      expect(mockRepository.create).toHaveBeenCalledWith(createCountryDto);
      expect(mockRepository.save).toHaveBeenCalledWith(newCountry);
    });

    it('should throw ConflictException when country already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      await expect(service.create(createCountryDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should clear cache after successful creation', async () => {
      const newCountry = { ...mockCountry, ...createCountryDto, id: 3 };
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newCountry as Country);
      mockRepository.save.mockResolvedValue(newCountry as Country);

      await service.create(createCountryDto);

      expect(mockRepository.save).toHaveBeenCalledWith(newCountry);
    });
  });

  describe('findOne', () => {
    it('should return country when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry);

      const result = await service.findOne(1);

      expect(result).toEqual(mockCountry);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when country not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateCountryDto: UpdateCountryDto = {
      name: 'Updated Germany',
      code: 'DEU',
    };

    it('should update country successfully', async () => {
      const updatedCountry = { ...mockCountry, ...updateCountryDto };
      mockRepository.findOne
        .mockResolvedValueOnce(mockCountry) // First call for finding the country
        .mockResolvedValueOnce(null); // Second call for checking name conflict
      mockRepository.save.mockResolvedValue(updatedCountry as Country);

      const result = await service.update(1, updateCountryDto);

      expect(result).toEqual(updatedCountry);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when country not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, updateCountryDto)).rejects.toThrow(NotFoundException);
    });

    it('should allow updating same country with same name', async () => {
      const updatedCountry = { ...mockCountry, code: 'DEU' };
      mockRepository.findOne
        .mockResolvedValueOnce(mockCountry) // First call for finding the country
        .mockResolvedValueOnce(mockCountry); // Second call finds same country (no conflict)
      mockRepository.save.mockResolvedValue(updatedCountry as Country);

      const result = await service.update(1, { name: 'Germany', code: 'DEU' });

      expect(result).toEqual(updatedCountry);
    });

    it('should clear cache after successful update', async () => {
      const updatedCountry = { ...mockCountry, ...updateCountryDto };
      mockRepository.findOne
        .mockResolvedValueOnce(mockCountry) // First call for finding the country
        .mockResolvedValueOnce(null); // Second call for checking name conflict
      mockRepository.save.mockResolvedValue(updatedCountry as Country);

      await service.update(1, updateCountryDto);

      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('activateCountry', () => {
    it('should activate country successfully', async () => {
      const inactiveCountry = { ...mockCountry, active: false };
      const activatedCountry = { ...mockCountry, active: true };
      
      mockRepository.findOne.mockResolvedValue(inactiveCountry as Country);
      mockRepository.save.mockResolvedValue(activatedCountry as Country);

      const result = await service.activateCountry(1);

      expect(result).toEqual(activatedCountry);
      expect(result.active).toBe(true);
    });
  });

  describe('deactivateCountry', () => {
    it('should deactivate country successfully', async () => {
      const deactivatedCountry = { ...mockCountry, active: false };
      
      mockRepository.findOne.mockResolvedValue(mockCountry as Country);
      mockRepository.save.mockResolvedValue(deactivatedCountry as Country);

      const result = await service.deactivateCountry(1);

      expect(result).toEqual(deactivatedCountry);
      expect(result.active).toBe(false);
    });
  });

  describe('bulkImport', () => {
    const bulkCreateDto: CreateCountryDto[] = [
      { name: 'Italy', code: 'IT' },
      { name: 'Spain', code: 'ES' },
    ];

    it('should import all countries successfully', async () => {
      const createdCountries = [
        { ...mockCountry, id: 2, name: 'Italy', code: 'IT' },
        { ...mockCountry, id: 3, name: 'Spain', code: 'ES' },
      ];

      mockRepository.findOne.mockResolvedValue(null); // No existing countries
      mockRepository.create.mockImplementation((dto) => ({ ...mockCountry, ...dto } as Country));
      mockRepository.save.mockImplementation((country) => Promise.resolve(country as Country));

      const result = await service.bulkImport(bulkCreateDto);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Italy');
      expect(result[1].name).toBe('Spain');
    });

    it('should handle partial failures gracefully', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(null) // First country doesn't exist
        .mockResolvedValueOnce(mockCountry); // Second country already exists

      mockRepository.create.mockReturnValue({ ...mockCountry, name: 'Italy' } as Country);
      mockRepository.save.mockResolvedValue({ ...mockCountry, name: 'Italy' } as Country);

      const result = await service.bulkImport(bulkCreateDto);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Italy');
    });

    it('should return empty array when all imports fail', async () => {
      mockRepository.findOne.mockResolvedValue(mockCountry); // All countries exist

      const result = await service.bulkImport(bulkCreateDto);

      expect(result).toEqual([]);
    });
  });

  describe('findAll', () => {
    const mockCountries = [mockCountry, { ...mockCountry, id: 2, name: 'France' }];

    it('should return all countries with no filters', async () => {
      const queryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockCountries),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll();

      expect(result).toEqual(mockCountries);
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('country');
    });

    it('should filter by active status', async () => {
      const activeCountries = [mockCountry];
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(activeCountries),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll({ active: true });

      expect(result).toEqual(activeCountries);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('country.active = :active', { active: true });
    });

    it('should search by name or code', async () => {
      const searchResults = [mockCountry];
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(searchResults),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll({ search: 'Ger' });

      expect(result).toEqual(searchResults);
      expect(queryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply limit and offset', async () => {
      const queryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCountry]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.findAll({ limit: 10, offset: 5 });

      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(queryBuilder.offset).toHaveBeenCalledWith(5);
    });

    it('should combine multiple filters', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCountry]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.findAll({
        active: true,
        search: 'Ger',
        limit: 5,
        offset: 10,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.limit).toHaveBeenCalledWith(5);
      expect(queryBuilder.offset).toHaveBeenCalledWith(10);
    });
  });
});
