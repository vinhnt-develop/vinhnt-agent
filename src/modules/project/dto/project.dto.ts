import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CreateProjectDto {
  @ApiProperty({ name: 'name', type: String, description: 'Project name', example: 'my-app' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Project description' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'path', type: String, description: 'Project path on filesystem', example: '/home/user/projects/my-app' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'path' })
  path?: string;

  @ApiPropertyOptional({ name: 'directory', type: String, description: 'Project directory (alias for path)' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'directory' })
  directory?: string;

  @ApiProperty({ name: 'workspaceId', type: String, description: 'Workspace ID' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'workspaceId' })
  workspaceId!: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ name: 'name', type: String, description: 'Project name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Expose({ name: 'name' })
  name?: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Project description' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'path', type: String, description: 'Project path on filesystem' })
  @IsOptional()
  @IsString()
  @Expose({ name: 'path' })
  path?: string;
}

export class ProjectResponseDto {
  @ApiProperty({ name: 'id', type: String, description: 'Project ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'workspaceId', type: String, description: 'Workspace ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  @Expose({ name: 'workspaceId' })
  workspaceId!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Project name', example: 'my-app' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'description', type: String, description: 'Project description' })
  @Expose({ name: 'description' })
  description?: string;

  @ApiPropertyOptional({ name: 'path', type: String, description: 'Project path', example: '/home/user/projects/my-app' })
  @Expose({ name: 'path' })
  path?: string;

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
}
