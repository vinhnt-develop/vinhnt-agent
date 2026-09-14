import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateProviderConfigDto {
  @ApiProperty({ description: 'Provider identifier', example: 'openai' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'provider' })
  provider!: string;

  @ApiProperty({ description: 'Config name', example: 'My OpenAI' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ description: 'API key' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'api_key' })
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Base URL for API calls', example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @IsUrl()
  @Expose({ name: 'base_url' })
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Additional config', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'configs' })
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Pricing info', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'pricing' })
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Is default provider', example: false })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'is_default' })
  isDefault?: boolean;
}

export class UpdateProviderConfigDto {
  @ApiPropertyOptional({ description: 'Config name', example: 'My OpenAI' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ description: 'API key' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'api_key' })
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Base URL', example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @IsUrl()
  @Expose({ name: 'base_url' })
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Additional config', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'configs' })
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Pricing info', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'pricing' })
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'is_active' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Is default', example: false })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'is_default' })
  isDefault?: boolean;
}

export class ProviderConfigResponseDto {
  @ApiProperty({ description: 'Config ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Provider identifier', example: 'openai' })
  @Expose({ name: 'provider' })
  provider!: string;

  @ApiPropertyOptional({ description: 'Config name', example: 'My OpenAI' })
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ description: 'Base URL', example: 'https://api.openai.com/v1' })
  @Expose({ name: 'base_url' })
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Additional config', type: 'object', additionalProperties: true })
  @Expose({ name: 'configs' })
  configs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Pricing info', type: 'object', additionalProperties: true })
  @Expose({ name: 'pricing' })
  pricing?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @Expose({ name: 'is_active' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Is default', example: false })
  @Expose({ name: 'is_default' })
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Whether API key is configured', example: true })
  @Expose({ name: 'has_api_key' })
  hasApiKey?: boolean;

  @ApiPropertyOptional({ description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;

  @ApiPropertyOptional({ description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updated_at' })
  @Transform(({ obj }) => obj.updated_at ?? obj.updatedAt)
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}