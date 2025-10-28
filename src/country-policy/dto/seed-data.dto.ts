import { IsString, IsArray, IsBoolean, ValidateNested, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export enum TravelType {
  TRAVEL = 'Travel',
  NON_TRAVEL = 'Non-Travel',
  BOTH = 'Both',
}

export enum MandatoryType {
  MANDATORY = 'Mandatory',
  OPTIONAL = 'Optional',
}

export enum YesNoType {
  YES = 'Yes',
  NO = 'No',
}

export class SeedReceiptStandardDto {
  @IsString()
  required_data: string;

  @IsEnum(TravelType)
  travel_non_travel_both: TravelType;

  @IsString()
  expense_type: string;

  @IsString()
  icp_name: string;

  @IsEnum(MandatoryType)
  mandatory_optional: MandatoryType;

  @IsString()
  rule: string;
}

export class SeedComplianceGrossUpDto {
  @IsEnum(TravelType)
  travel_non_travel_both: TravelType;

  @IsString()
  expense_type: string;

  @IsString()
  icp_name: string;

  @IsBoolean()
  gross_up: boolean;

  @IsString()
  gross_up_rule: string;
}

export class SeedComplianceAdditionalInfoDto {
  @IsEnum(TravelType)
  travel_non_travel_both: TravelType;

  @IsString()
  expense_type: string;

  @IsString()
  icp_name: string;

  @IsBoolean()
  additional_info_required: boolean;

  @IsString()
  additional_info_rule: string;
}

export class CountrySeedDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedReceiptStandardDto)
  receiptStandards: SeedReceiptStandardDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedComplianceGrossUpDto)
  compliancePoliciesGrossUpRelated: SeedComplianceGrossUpDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeedComplianceAdditionalInfoDto)
  compliancePoliciesAdditionalInfoRelated: SeedComplianceAdditionalInfoDto[];
}
