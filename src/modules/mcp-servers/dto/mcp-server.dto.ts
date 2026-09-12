import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateMcpServerDto {
  @ApiProperty({ description: 'Server name', example: 'filesystem' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Transport type', enum: ['stdio', 'sse', 'streamable-http'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['stdio', 'sse', 'streamable-http'])
  transport!: string;

  @ApiPropertyOptional({ description: 'Command for stdio transport', example: 'npx' })
  @IsOptional()
  @IsString()
  command?: string;

  @ApiPropertyOptional({ description: 'Command arguments for stdio transport', example: ['-y', '@modelcontextprotocol/server-filesystem'] })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: 'URL for SSE/HTTP transport', example: 'http://localhost:3001/mcp' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Environment variables' })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateMcpServerDto {
  @ApiPropertyOptional({ description: 'Server name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Transport type' })
  @IsOptional()
  @IsString()
  @IsIn(['stdio', 'sse', 'streamable-http'])
  transport?: string;

  @ApiPropertyOptional({ description: 'Command for stdio transport' })
  @IsOptional()
  @IsString()
  command?: string;

  @ApiPropertyOptional({ description: 'Command arguments' })
  @IsOptional()
  args?: string[];

  @ApiPropertyOptional({ description: 'URL for SSE/HTTP transport' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Environment variables' })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Is enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class McpServerResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'name' }) name!: string;
  @Expose({ name: 'transport' }) transport!: string;
  @Expose({ name: 'command' }) command?: string;
  @Expose({ name: 'args' }) args?: string[];
  @Expose({ name: 'url' }) url?: string;
  @Expose({ name: 'env' }) env?: Record<string, string>;
  @Expose({ name: 'is_enabled' })
  @Transform(({ obj }) => obj.is_enabled ?? obj.isEnabled)
  isEnabled?: boolean;
  @Expose({ name: 'tool_count' })
  @Transform(({ obj }) => obj.tool_count ?? obj.toolCount)
  toolCount?: number;
  @Expose({ name: 'last_connected_at' })
  @Transform(({ obj }) => obj.last_connected_at ?? obj.lastConnectedAt)
  lastConnectedAt?: string;
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
