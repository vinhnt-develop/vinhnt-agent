import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsObject,
  IsArray,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class McpGovernanceDto {
  @ApiPropertyOptional({
    description: 'Raw MCP tool names to expose; empty array exposes none',
    name: 'allowedTools',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Expose({ name: 'allowedTools' })
  allowedTools?: string[];

  @ApiPropertyOptional({
    description: 'Raw MCP tool names to remove after the allowlist',
    name: 'deniedTools',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Expose({ name: 'deniedTools' })
  deniedTools?: string[];

  @ApiPropertyOptional({
    description: 'Text output cap in bytes before spilling; 0 disables',
    minimum: 0,
    name: 'maxOutputBytes',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Expose({ name: 'maxOutputBytes' })
  maxOutputBytes?: number;

  @ApiPropertyOptional({
    description: 'Directory for spilled output; defaults to the OS temp dir',
    name: 'spillDir',
    type: String,
  })
  @IsOptional()
  @IsString()
  @Expose({ name: 'spillDir' })
  spillDir?: string;

  @ApiPropertyOptional({
    description: 'Expose tool search when the filtered catalog reaches this size',
    minimum: 1,
    name: 'searchThreshold',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Expose({ name: 'searchThreshold' })
  searchThreshold?: number;
}

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

  @ApiPropertyOptional({ description: 'HTTP headers for SSE/HTTP transport', name: 'headers', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'headers' })
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Connection and request timeout in milliseconds', default: 30000, minimum: 1000, maximum: 300000, name: 'timeoutMs', type: Number })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  @Expose({ name: 'timeoutMs' })
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Per-server tool/output governance', name: 'governance', type: McpGovernanceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => McpGovernanceDto)
  @Expose({ name: 'governance' })
  governance?: McpGovernanceDto;

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

  @ApiPropertyOptional({ description: 'HTTP headers for SSE/HTTP transport', name: 'headers', type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  @Expose({ name: 'headers' })
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Connection and request timeout in milliseconds', minimum: 1000, maximum: 300000, name: 'timeoutMs', type: Number })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(300000)
  @Expose({ name: 'timeoutMs' })
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Per-server tool/output governance; null clears it', name: 'governance', type: McpGovernanceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => McpGovernanceDto)
  @Expose({ name: 'governance' })
  governance?: McpGovernanceDto | null;

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

  @ApiPropertyOptional({ description: 'HTTP headers for SSE/HTTP transport', name: 'headers', type: 'object', additionalProperties: true })
  @Expose({ name: 'headers' })
  headers?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Connection and request timeout in milliseconds', name: 'timeoutMs', type: Number })
  @Expose({ name: 'timeoutMs' })
  timeoutMs?: number;

  @ApiPropertyOptional({ description: 'Per-server tool/output governance', name: 'governance', type: McpGovernanceDto })
  @Type(() => McpGovernanceDto)
  @Expose({ name: 'governance' })
  governance?: McpGovernanceDto;

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
