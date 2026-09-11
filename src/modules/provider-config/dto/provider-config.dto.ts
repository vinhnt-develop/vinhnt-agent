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

  @ApiPropertyOptional({ description: 'API key (will be encrypted)' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Base URL for API calls' })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Default model ID' })
  @IsOptional()
  @IsString()
  defaultModel?: string;

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

  @ApiPropertyOptional({ description: 'API key (will be encrypted)' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({ description: 'Base URL' })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ description: 'Default model ID' })
  @IsOptional()
  @IsString()
  defaultModel?: string;

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
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'provider' }) provider!: string;
  @Expose({ name: 'name' }) name?: string;
  @Expose({ name: 'api_key' })
  @Transform(({ obj }) => obj.api_key ?? obj.apiKey)
  apiKey?: string;
  @Expose({ name: 'base_url' })
  @Transform(({ obj }) => obj.base_url ?? obj.baseUrl)
  baseUrl?: string;
  @Expose({ name: 'default_model' })
  @Transform(({ obj }) => obj.default_model ?? obj.defaultModel)
  defaultModel?: string;
  @Expose({ name: 'configs' }) configs?: Record<string, unknown>;
  @Expose({ name: 'is_active' })
  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  isActive?: boolean;
  @Expose({ name: 'is_default' })
  @Transform(({ obj }) => obj.is_default ?? obj.isDefault)
  isDefault?: boolean;
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;
  @Expose({ name: 'updated_at' })
  @Transform(({ obj }) => obj.updated_at ?? obj.updatedAt)
  updatedAt?: string;
  @Expose({ name: 'deleted_at' })
  @Transform(({ obj }) => obj.deleted_at ?? obj.deletedAt)
  deletedAt?: string;
}
