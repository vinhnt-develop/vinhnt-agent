import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateCredentialDto {
  @ApiProperty({ description: 'Credential name', example: 'github-token' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Display label' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ description: 'Credential type', example: 'api_key' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ description: 'Credential value (will be encrypted)' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class UpdateCredentialDto {
  @ApiPropertyOptional({ description: 'Credential name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Display label' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Credential type' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Credential value (will be encrypted)' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class CredentialResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'name' }) name!: string;
  @Expose({ name: 'label' }) label?: string;
  @Expose({ name: 'type' }) type!: string;
  @Expose({ name: 'metadata' }) metadata?: Record<string, unknown>;
  @Expose({ name: 'expires_at' })
  @Transform(({ obj }) => obj.expires_at ?? obj.expiresAt)
  expiresAt?: string;
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
