import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name', example: 'my-app' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Project path on filesystem', example: '/home/user/projects/my-app' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ description: 'Project directory (alias for path)' })
  @IsOptional()
  @IsString()
  directory?: string;

  @ApiProperty({ description: 'Workspace ID' })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Project name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Project path on filesystem' })
  @IsOptional()
  @IsString()
  path?: string;
}

export class ProjectResponseDto {
  @Expose({ name: 'id' }) id!: string;
  @Expose({ name: 'workspace_id' })
  @Transform(({ obj }) => obj.workspace_id ?? obj.workspaceId)
  workspaceId!: string;
  @Expose({ name: 'name' }) name!: string;
  @Expose({ name: 'description' }) description?: string;
  @Expose({ name: 'path' }) path?: string;
  @Expose({ name: 'is_active' })
  @Transform(({ obj }) => obj.is_active ?? obj.isActive)
  isActive?: boolean;
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
