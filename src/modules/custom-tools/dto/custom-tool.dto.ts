import { IsString, IsOptional, IsNumber, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateCustomToolDto {
  @ApiProperty({ name: 'name', type: String, description: 'Tool name' })
  @IsString()
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Tool description' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'inputSchema', type: 'object', description: 'Input JSON schema', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'inputSchema' })
  inputSchema?: Record<string, any>;

  @ApiPropertyOptional({ name: 'handlerType', type: String, description: 'Handler type', enum: ['webhook', 'mock'], default: 'webhook' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'handlerType' })
  handlerType?: string;

  @ApiPropertyOptional({ name: 'handlerConfig', type: 'object', description: 'Handler config (url, mockResponse, etc.)', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'handlerConfig' })
  handlerConfig?: Record<string, any>;

  @ApiPropertyOptional({ name: 'timeoutMs', type: Number, description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  @Expose({ name: 'timeoutMs' })
  timeoutMs?: number;
}

export class UpdateCustomToolDto {
  @ApiPropertyOptional({ name: 'name', type: String, description: 'Tool name' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Tool description' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'inputSchema', type: 'object', description: 'Input JSON schema', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'inputSchema' })
  inputSchema?: Record<string, any>;

  @ApiPropertyOptional({ name: 'handlerType', type: String, description: 'Handler type' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'handlerType' })
  handlerType?: string;

  @ApiPropertyOptional({ name: 'handlerConfig', type: 'object', description: 'Handler config', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'handlerConfig' })
  handlerConfig?: Record<string, any>;

  @ApiPropertyOptional({ name: 'timeoutMs', type: Number, description: 'Timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Expose({ name: 'timeoutMs' })
  timeoutMs?: number;

  @ApiPropertyOptional({ name: 'isActive', type: Boolean, description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isActive' })
  isActive?: boolean;
}

export class CustomToolResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Tool ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Tool name' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ name: 'description', type: String, description: 'Tool description' })
  @Expose({ name: 'description' })
  description!: string;

  @ApiProperty({ name: 'inputSchema', type: 'object', description: 'Input JSON schema', additionalProperties: true })
  @Expose({ name: 'inputSchema' })
  inputSchema!: Record<string, any>;

  @ApiProperty({ name: 'handlerType', type: String, description: 'Handler type' })
  @Expose({ name: 'handlerType' })
  handlerType!: string;

  @ApiProperty({ name: 'handlerConfig', type: 'object', description: 'Handler config', additionalProperties: true })
  @Expose({ name: 'handlerConfig' })
  handlerConfig!: Record<string, any>;

  @ApiProperty({ name: 'timeoutMs', type: Number, description: 'Timeout in milliseconds' })
  @Expose({ name: 'timeoutMs' })
  timeoutMs!: number;

  @ApiProperty({ name: 'isActive', type: Boolean, description: 'Is active' })
  @Expose({ name: 'isActive' })
  isActive!: boolean;

  @ApiProperty({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'createdAt' })
  createdAt!: string;

  @ApiProperty({ name: 'updatedAt', type: String, description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updatedAt' })
  updatedAt!: string;
}
