import { IsString, IsOptional, IsNumber, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateCustomToolDto {
  @ApiProperty({ description: 'Tool name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Tool description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Input JSON schema' })
  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Handler type', enum: ['webhook', 'mock'], default: 'webhook' })
  @IsOptional()
  @IsString()
  handlerType?: string;

  @ApiPropertyOptional({ description: 'Handler config (url, mockResponse, etc.)' })
  @IsOptional()
  @IsObject()
  handlerConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;
}

export class UpdateCustomToolDto {
  @ApiPropertyOptional({ description: 'Tool name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Tool description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Input JSON schema' })
  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Handler type' })
  @IsOptional()
  @IsString()
  handlerType?: string;

  @ApiPropertyOptional({ description: 'Handler config' })
  @IsOptional()
  @IsObject()
  handlerConfig?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds' })
  @IsOptional()
  @IsNumber()
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CustomToolResponseDto {
  @ApiProperty()
  @Expose({ name: 'id' })
  id: string;

  @ApiProperty()
  @Expose({ name: 'name' })
  name: string;

  @ApiProperty()
  @Expose({ name: 'description' })
  description: string;

  @ApiProperty()
  @Expose({ name: 'input_schema' })
  @Transform(({ obj }) => obj.input_schema ?? obj.inputSchema)
  inputSchema: Record<string, any>;

  @ApiProperty()
  @Expose({ name: 'handler_type' })
  @Transform(({ obj }) => obj.handler_type ?? obj.handlerType)
  handlerType: string;

  @ApiProperty()
  @Expose({ name: 'handler_config' })
  @Transform(({ obj }) => obj.handler_config ?? obj.handlerConfig)
  handlerConfig: Record<string, any>;

  @ApiProperty()
  @Expose({ name: 'timeout_ms' })
  @Transform(({ obj }) => obj.timeout_ms ?? obj.timeoutMs)
  timeoutMs: number;

  @ApiProperty()
  @Expose({ name: 'is_active' })
  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  isActive: boolean;

  @ApiProperty()
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt: string;

  @ApiProperty()
  @Expose({ name: 'updated_at' })
  @Transform(({ obj }) => obj.updated_at ?? obj.updatedAt)
  updatedAt: string;
}
