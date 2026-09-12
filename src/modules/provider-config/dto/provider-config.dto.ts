import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateProviderConfigDto {
  @ApiProperty({ description: 'Provider identifier', example: 'openai' })
  @IsString()
  @IsNotEmpty()
  provider!: string;

  @ApiProperty({ description: 'Config name', example: 'My OpenAI' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'API key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Base URL for API calls' })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Additional config' })
  @IsOptional()
  @IsObject()
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Pricing info' })
  @IsOptional()
  @IsObject()
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Is default provider' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateProviderConfigDto {
  @ApiPropertyOptional({ description: 'Config name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'API key' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Base URL' })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Additional config' })
  @IsOptional()
  @IsObject()
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Pricing info' })
  @IsOptional()
  @IsObject()
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Is default' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ProviderConfigResponseDto {
  @Expose() id!: string;
  @Expose() provider!: string;
  @Expose() name?: string;
  @Expose() baseUrl?: string;
  @Expose() configs?: Record<string, unknown>;
  @Expose() pricing?: Record<string, unknown>;
  @Expose() isActive?: boolean;
  @Expose() isDefault?: boolean;
  @Expose()
  @Transform(({ obj }) => !!obj.apiKey && obj.apiKey.length > 0)
  hasApiKey?: boolean;
  @Expose() createdAt?: string;
  @Expose() updatedAt?: string;
}
