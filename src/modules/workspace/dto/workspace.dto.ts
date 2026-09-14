import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateWorkspaceDto {
  @ApiProperty({ description: 'Workspace name', example: 'My Project' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Workspace description', example: 'A project for testing' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Workspace name', example: 'My Project' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ description: 'Workspace description', example: 'Updated description' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;
}

export class WorkspaceResponseDto {
  @ApiProperty({ description: 'Workspace ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Workspace name', example: 'My Project' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Workspace description', example: 'A project for testing' })
  @Expose({ name: 'description' })
  description?: string;

  @ApiProperty({ description: 'Owner ID', example: 'local-user' })
  @Expose({ name: 'owner_id' })
  @Transform(({ obj }) => obj.owner_id ?? obj.ownerId)
  ownerId!: string;

  @ApiPropertyOptional({ description: 'Is active', example: true })
  @Expose({ name: 'is_active' })
  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Creation timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'created_at' })
  @Transform(({ obj }) => obj.created_at ?? obj.createdAt)
  createdAt?: string;

  @ApiPropertyOptional({ description: 'Last update timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'updated_at' })
  @Transform(({ obj }) => obj.updated_at ?? obj.updatedAt)
  updatedAt?: string;

  @ApiPropertyOptional({ description: 'Deletion timestamp (ISO 8601)', example: '2026-09-01T12:00:00.000Z' })
  @Expose({ name: 'deleted_at' })
  @Transform(({ obj }) => obj.deleted_at ?? obj.deletedAt)
  deletedAt?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}