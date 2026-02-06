
import { Test, TestingModule } from '@nestjs/testing';
import { CountryPolicyController } from './country-policy.controller';
import { CountryPolicyService } from '../services/country-policy.service';
import { NotFoundException } from '@nestjs/common';

describe('CountryPolicyController', () => {
    let controller: CountryPolicyController;
    let service: CountryPolicyService;

    const mockCountryPolicyService = {
        findCountryByName: jest.fn(),
        deleteCountry: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CountryPolicyController],
            providers: [
                {
                    provide: CountryPolicyService,
                    useValue: mockCountryPolicyService,
                },
            ],
        }).compile();

        controller = module.get<CountryPolicyController>(CountryPolicyController);
        service = module.get<CountryPolicyService>(CountryPolicyService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getCountryPolicy', () => {
        it('should return country policy when found', async () => {
            const mockCountry = {
                id: 1,
                name: 'Germany',
                code: 'DE',
                activePolicy: { id: 123 },
            };
            mockCountryPolicyService.findCountryByName.mockResolvedValue(mockCountry);

            const result = await controller.getCountryPolicy('Germany');

            expect(result).toEqual(mockCountry);
            expect(service.findCountryByName).toHaveBeenCalledWith('Germany');
        });

        it('should throw NotFoundException when service throws it', async () => {
            mockCountryPolicyService.findCountryByName.mockRejectedValue(new NotFoundException());

            await expect(controller.getCountryPolicy('Unknown')).rejects.toThrow(NotFoundException);
        });
    });

    describe('deleteCountry', () => {
        it('should delete country and return success message', async () => {
            mockCountryPolicyService.deleteCountry.mockResolvedValue(undefined);

            const result = await controller.deleteCountry('Germany');

            expect(result).toEqual({
                success: true,
                message: 'Country "Germany" and all associated data have been deleted.',
            });
            expect(service.deleteCountry).toHaveBeenCalledWith('Germany');
        });

        it('should throw error when service throws it', async () => {
            const error = new Error('Database error');
            mockCountryPolicyService.deleteCountry.mockRejectedValue(error);

            await expect(controller.deleteCountry('Germany')).rejects.toThrow(error);
        });
    });
});
