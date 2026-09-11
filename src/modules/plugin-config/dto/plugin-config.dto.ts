import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsIn, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreatePluginConfigDto {
  @ApiProperty({ description: 'Plugin ID', example: 'file-explorer' })
  @IsString()
  @IsNotEmpty()
  pluginId!: string;

  @ApiProperty({ description: 'Plugin source', enum: ['builtin', 'community', 'custom'], default: 'custom' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['builtin', 'community', 'custom'])
  source!: string;

  @ApiPropertyOptional({ description: 'Plugin version', example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Plugin author' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Plugin repository URL' })
  @IsOptional()
  @IsString()
  repository?: string;

  @ApiPropertyOptional({ description: 'Plugin description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Plugin dependencies', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @ApiPropertyOptional({ description: 'Local plugin path (for custom plugins)' })
  @IsOptional()
  @IsString()
  localPath?: string;

  @ApiPropertyOptional({ description: 'Plugin config', example: { autoRefresh: true } })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is enabled', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdatePluginConfigDto {
  @ApiPropertyOptional({ description: 'Plugin source' })
  @IsOptional()
  @IsString()
  @IsIn(['builtin', 'community', 'custom'])
  source?: string;

  @ApiPropertyOptional({ description: 'Plugin version' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ description: 'Plugin config' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Is enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class PluginConfigResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'plugin_id' })
  @Transform(({ obj }) => obj.plugin_id ?? obj.pluginId)
  pluginId!: string;
  @Expose({ name: 'source' }) source!: string;
  @Expose({ name: 'version' }) version?: string;
  @Expose({ name: 'latest_version' })
  @Transform(({ obj }) => obj.latest_version ?? obj.latestVersion)
  latestVersion?: string;
  @Expose({ name: 'author' }) author?: string;
  @Expose({ name: 'repository' }) repository?: string;
  @Expose({ name: 'description' }) description?: string;
  @Expose({ name: 'dependencies' }) dependencies?: string[];
  @Expose({ name: 'local_path' })
  @Transform(({ obj }) => obj.local_path ?? obj.localPath)
  localPath?: string;
  @Expose({ name: 'config' }) config?: Record<string, unknown>;
  @Expose({ name: 'is_enabled' })
  @Transform(({ obj }) => obj.is_enabled ?? obj.isEnabled)
  isEnabled?: boolean;
  @Expose({ name: 'installed_at' })
  @Transform(({ obj }) => obj.installed_at ?? obj.installedAt)
  installedAt?: string;
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
