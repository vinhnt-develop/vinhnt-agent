import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateCredentialDto {
  @ApiProperty({ name: 'name', type: String, description: 'Credential name', example: 'github-token' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'label', type: String, description: 'Display label' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'label' })
  label?: string;

  @ApiProperty({ name: 'type', type: String, description: 'Credential type', example: 'api_key' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'type' })
  type!: string;

  @ApiProperty({ name: 'value', type: String, description: 'Credential value' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'value' })
  value!: string;

  @ApiPropertyOptional({ name: 'metadata', type: Object, description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'expiresAt', type: String, description: 'Expiry date' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'expiresAt' })
  expiresAt?: string;
}

export class UpdateCredentialDto {
  @ApiPropertyOptional({ name: 'name', type: String, description: 'Credential name' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'label', type: String, description: 'Display label' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'label' })
  label?: string;

  @ApiPropertyOptional({ name: 'type', type: String, description: 'Credential type' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'type' })
  type?: string;

  @ApiPropertyOptional({ name: 'value', type: String, description: 'Credential value' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'value' })
  value?: string;

  @ApiPropertyOptional({ name: 'metadata', type: Object, description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'expiresAt', type: String, description: 'Expiry date' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'expiresAt' })
  expiresAt?: string;
}

export class CredentialResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Credential ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Credential name', example: 'github-token' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'label', type: String, description: 'Display label' })
  @Expose({ name: 'label' })
  label?: string;

  @ApiProperty({ name: 'type', type: String, description: 'Credential type', example: 'api_key' })
  @Expose({ name: 'type' })
  type!: string;

  @ApiPropertyOptional({ name: 'metadata', type: Object, description: 'Additional metadata' })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'expiresAt', type: String, description: 'Expiry date (ISO 8601)', example: '2026-12-31T23:59:59.000Z' })
  @Expose({ name: 'expiresAt' })
  expiresAt?: string;

  @ApiPropertyOptional({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'createdAt' })
  createdAt?: string;

  @ApiPropertyOptional({ name: 'updatedAt', type: String, description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updatedAt' })
  updatedAt?: string;
}
