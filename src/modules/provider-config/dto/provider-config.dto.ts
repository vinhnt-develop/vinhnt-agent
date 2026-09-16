import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateProviderConfigDto {
  @ApiProperty({ name: 'provider', type: String, description: 'Provider identifier', example: 'openai' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'provider' })
  provider!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Config name', example: 'My OpenAI' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'apiKey', type: String, description: 'API key' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'apiKey' })
  apiKey?: string;

  @ApiPropertyOptional({ name: 'baseUrl', type: String, description: 'Base URL for API calls', example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @IsUrl()
  @Expose({ name: 'baseUrl' })
  baseUrl?: string;

  @ApiPropertyOptional({ name: 'configs', type: 'object', description: 'Additional config', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'configs' })
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'pricing', type: 'object', description: 'Pricing info', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'pricing' })
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'isDefault', type: Boolean, description: 'Is default provider', example: false })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isDefault' })
  isDefault?: boolean;
}

export class UpdateProviderConfigDto {
  @ApiPropertyOptional({ name: 'name', type: String, description: 'Config name', example: 'My OpenAI' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'apiKey', type: String, description: 'API key' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'apiKey' })
  apiKey?: string;

  @ApiPropertyOptional({ name: 'baseUrl', type: String, description: 'Base URL', example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @IsUrl()
  @Expose({ name: 'baseUrl' })
  baseUrl?: string;

  @ApiPropertyOptional({ name: 'configs', type: 'object', description: 'Additional config', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'configs' })
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'pricing', type: 'object', description: 'Pricing info', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'pricing' })
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'isActive', type: Boolean, description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isActive' })
  isActive?: boolean;

  @ApiPropertyOptional({ name: 'isDefault', type: Boolean, description: 'Is default', example: false })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isDefault' })
  isDefault?: boolean;
}

export class ProviderConfigResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Config ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'provider', type: String, description: 'Provider identifier', example: 'openai' })
  @Expose({ name: 'provider' })
  provider!: string;

  @ApiPropertyOptional({ name: 'name', type: String, description: 'Config name', example: 'My OpenAI' })
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'baseUrl', type: String, description: 'Base URL', example: 'https://api.openai.com/v1' })
  @Expose({ name: 'baseUrl' })
  baseUrl?: string;

  @ApiPropertyOptional({ name: 'configs', type: 'object', description: 'Additional config', additionalProperties: true })
  @Expose({ name: 'configs' })
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'pricing', type: 'object', description: 'Pricing info', additionalProperties: true })
  @Expose({ name: 'pricing' })
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'isActive', type: Boolean, description: 'Is active', example: true })
  @Expose({ name: 'isActive' })
  isActive?: boolean;

  @ApiPropertyOptional({ name: 'isDefault', type: Boolean, description: 'Is default', example: false })
  @Expose({ name: 'isDefault' })
  isDefault?: boolean;

  @ApiPropertyOptional({ name: 'hasApiKey', type: Boolean, description: 'Whether API key is configured', example: true })
  @Expose({ name: 'hasApiKey' })
  hasApiKey?: boolean;

  @ApiPropertyOptional({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'createdAt' })
  createdAt?: string;

  @ApiPropertyOptional({ name: 'updatedAt', type: String, description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updatedAt' })
  updatedAt?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}
