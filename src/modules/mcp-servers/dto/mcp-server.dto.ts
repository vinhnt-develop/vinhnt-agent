import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateMcpServerDto {
  @ApiProperty({ description: 'Server name', example: 'filesystem', name: 'name', type: String })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ description: 'Transport type', enum: ['stdio', 'sse', 'streamable-http'], name: 'transport', type: String })
  @IsString()
  @IsNotEmpty()
  @IsIn(['stdio', 'sse', 'streamable-http'])
  @Expose({ name: 'transport' })
  transport!: string;

  @ApiPropertyOptional({ description: 'Command for stdio transport', example: 'npx', name: 'command', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'command' })
  command?: string;

  @ApiPropertyOptional({ description: 'Command arguments for stdio transport', example: ['-y', '@modelcontextprotocol/server-filesystem'], name: 'args', type: [String] })
  @IsOptional()
  @IsArray()
  @Expose({ name: 'args' })
  args?: string[];

  @ApiPropertyOptional({ description: 'URL for SSE/HTTP transport', example: 'http://localhost:3001/mcp', name: 'url', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'url' })
  url?: string;

  @ApiPropertyOptional({ description: 'Environment variables', name: 'env', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'env' })
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Is enabled', default: true, name: 'isEnabled', type: Boolean })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isEnabled' })
  isEnabled?: boolean;
}

export class UpdateMcpServerDto {
  @ApiPropertyOptional({ description: 'Server name', name: 'name', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ description: 'Transport type', enum: ['stdio', 'sse', 'streamable-http'], name: 'transport', type: String })
  @IsOptional()
  @IsString()
  @IsIn(['stdio', 'sse', 'streamable-http'])
  @Expose({ name: 'transport' })
  transport?: string;

  @ApiPropertyOptional({ description: 'Command for stdio transport', name: 'command', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'command' })
  command?: string;

  @ApiPropertyOptional({ description: 'Command arguments', name: 'args', type: [String] })
  @IsOptional()
  @IsArray()
  @Expose({ name: 'args' })
  args?: string[];

  @ApiPropertyOptional({ description: 'URL for SSE/HTTP transport', name: 'url', type: String })
  @IsOptional()
  @IsString()
  @Expose({ name: 'url' })
  url?: string;

  @ApiPropertyOptional({ description: 'Environment variables', name: 'env', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'env' })
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Is enabled', name: 'isEnabled', type: Boolean })
  @IsOptional()
  @IsBoolean()
  @Expose({ name: 'isEnabled' })
  isEnabled?: boolean;
}

export class McpServerResponseDto {
  @ApiProperty({ description: 'Server ID', example: '123e4567-e89b-12d3-a456-426614174000', name: 'id', type: String })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Server name', example: 'filesystem', name: 'name', type: String })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ description: 'Transport type', enum: ['stdio', 'sse', 'streamable-http'], name: 'transport', type: String })
  @Expose({ name: 'transport' })
  transport!: string;

  @ApiPropertyOptional({ description: 'Command for stdio transport', example: 'npx', name: 'command', type: String })
  @Expose({ name: 'command' })
  command?: string;

  @ApiPropertyOptional({ description: 'Command arguments', example: ['-y', '@modelcontextprotocol/server-filesystem'], name: 'args', type: [String] })
  @Expose({ name: 'args' })
  args?: string[];

  @ApiPropertyOptional({ description: 'URL for SSE/HTTP transport', example: 'http://localhost:3001/mcp', name: 'url', type: String })
  @Expose({ name: 'url' })
  url?: string;

  @ApiPropertyOptional({ description: 'Environment variables', name: 'env', type: 'object', additionalProperties: true })
  @Expose({ name: 'env' })
  env?: Record<string, string>;

  @ApiProperty({ description: 'Is enabled', example: true, name: 'isEnabled', type: Boolean })
  @Expose({ name: 'isEnabled' })
  isEnabled?: boolean;

  @ApiProperty({ description: 'Number of tools', example: 5, name: 'toolCount', type: Number })
  @Expose({ name: 'toolCount' })
  toolCount?: number;

  @ApiPropertyOptional({ description: 'Last connected timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'lastConnectedAt', type: String })
  @Expose({ name: 'lastConnectedAt' })
  lastConnectedAt?: string;

  @ApiProperty({ description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'createdAt', type: String })
  @Expose({ name: 'createdAt' })
  createdAt?: string;

  @ApiProperty({ description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'updatedAt', type: String })
  @Expose({ name: 'updatedAt' })
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Deletion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z', name: 'deletedAt', type: String })
  @Expose({ name: 'deletedAt' })
  deletedAt?: string;
}
