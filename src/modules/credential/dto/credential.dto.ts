import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

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

  @ApiProperty({ description: 'Credential value' })
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

  @ApiPropertyOptional({ description: 'Credential value' })
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
  @Expose() id!: string;
  @Expose() name!: string;
  @Expose() label?: string;
  @Expose() type!: string;
  @Expose() metadata?: Record<string, unknown>;
  @Expose() expiresAt?: string;
  @Expose() createdAt?: string;
  @Expose() updatedAt?: string;
}
