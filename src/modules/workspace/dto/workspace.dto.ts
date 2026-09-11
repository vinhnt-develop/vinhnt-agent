import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class CreateWorkspaceDto {
  @ApiProperty({ description: 'Workspace name', example: 'My Project' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Workspace description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Workspace name' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Workspace description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class WorkspaceResponseDto {
  @Expose({ name: 'id' })
  id!: string;

  @Expose({ name: 'name' })
  name!: string;

  @Expose({ name: 'description' })
  description?: string;

  @Expose({ name: 'owner_id' })
  @Transform(({ obj }) => obj.owner_id ?? obj.ownerId)
  ownerId!: string;

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
