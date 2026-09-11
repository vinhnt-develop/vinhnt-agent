import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateToolConfigDto {
  @ApiProperty({ description: 'Tool ID', example: 'read_file' })
  @IsString()
  @IsNotEmpty()
  toolId!: string;

  @ApiProperty({ description: 'Tool source', enum: ['builtin', 'mcp', 'custom'], default: 'custom' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['builtin', 'mcp', 'custom'])
  source!: string;

  @ApiPropertyOptional({ description: 'MCP server name (for MCP tools)' })
  @IsOptional()
  @IsString()
  mcpServerName?: string;

  @ApiPropertyOptional({ description: 'MCP tool name (for MCP tools)' })
  @IsOptional()
  @IsString()
  mcpToolName?: string;

  @ApiPropertyOptional({ description: 'Tool version' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Tool config', example: { maxFileSize: 1024 } })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Tool manifest (name, description, author, etc.)' })
  @IsOptional()
  @IsObject()
  manifest?: Record<string, any>;
}

export class UpdateToolConfigDto {
  @ApiPropertyOptional({ description: 'Tool source' })
  @IsOptional()
  @IsString()
  @IsIn(['builtin', 'mcp', 'custom'])
  source?: string;

  @ApiPropertyOptional({ description: 'Tool version' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Tool config' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Tool manifest' })
  @IsOptional()
  @IsObject()
  manifest?: Record<string, any>;
}

export class ToolConfigResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'tool_id' })
  @Transform(({ obj }) => obj.tool_id ?? obj.toolId)
  toolId!: string;
  @Expose({ name: 'source' }) source!: string;
  @Expose({ name: 'mcp_server_name' })
  @Transform(({ obj }) => obj.mcp_server_name ?? obj.mcpServerName)
  mcpServerName?: string;
  @Expose({ name: 'mcp_tool_name' })
  @Transform(({ obj }) => obj.mcp_tool_name ?? obj.mcpToolName)
  mcpToolName?: string;
  @Expose({ name: 'version' }) version?: string;
  @Expose({ name: 'config' }) config?: Record<string, unknown>;
  @Expose({ name: 'is_enabled' })
  @Transform(({ obj }) => obj.is_enabled ?? obj.isEnabled)
  isEnabled?: boolean;
  @Expose({ name: 'manifest' }) manifest?: Record<string, unknown>;
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
