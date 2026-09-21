import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class CreateWorkspaceDto {
  @ApiProperty({ name: 'name', type: String, description: 'Workspace name', example: 'My Project' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Workspace description', example: 'A project for testing' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'path', type: String, description: 'Filesystem root for this workspace', example: '/home/user/projects' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'path' })
  path?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ name: 'name', type: String, description: 'Workspace name', example: 'My Project' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Updated description' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'path', type: String, description: 'Filesystem root for this workspace' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'path' })
  path?: string;
}

export class WorkspaceResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Workspace ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Workspace name', example: 'My Project' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Workspace description', example: 'A project for testing' })
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'path', type: String, description: 'Filesystem root for this workspace' })
  @Expose({ name: 'path' })
  path?: string;

  @ApiProperty({ name: 'ownerId', type: String, description: 'Owner ID', example: 'local-user' })
  @Expose({ name: 'ownerId' })
  ownerId!: string;

  @ApiPropertyOptional({ name: 'isActive', type: Boolean, description: 'Is active', example: true })
  @Expose({ name: 'isActive' })
  isActive?: boolean;

  @ApiPropertyOptional({ name: 'createdAt', type: String, description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'createdAt' })
  createdAt?: string;

  @ApiPropertyOptional({ name: 'updatedAt', type: String, description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updatedAt' })
  updatedAt?: string;

  @ApiPropertyOptional({ name: 'deletedAt', type: String, description: 'Deletion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'deletedAt' })
  deletedAt?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class ListWorkspacesDto extends PaginationDto {}
