import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class BrowseRootResponseDto {
  @ApiProperty({ name: 'path', type: String, description: 'Absolute directory path' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Display name' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ name: 'kind', enum: ['home', 'workspace', 'custom'], description: 'Root source' })
  @Expose({ name: 'kind' })
  kind!: 'home' | 'workspace' | 'custom';
}

export class BrowseEntryDto {
  @ApiProperty({ name: 'name', type: String, description: 'Directory name' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ name: 'path', type: String, description: 'Absolute directory path' })
  @Expose({ name: 'path' })
  path!: string;
}

export class DirectoryListResponseDto {
  @ApiProperty({ name: 'path', type: String, description: 'Absolute path that was listed' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiPropertyOptional({ name: 'parent', type: String, description: 'Parent directory, if navigable' })
  @Expose({ name: 'parent' })
  parent?: string;

  @ApiProperty({ name: 'isRoot', type: Boolean, description: 'At the top of an allowed root' })
  @Expose({ name: 'isRoot' })
  isRoot!: boolean;

  @ApiProperty({ name: 'canCreate', type: Boolean, description: 'Directory is writable' })
  @Expose({ name: 'canCreate' })
  canCreate!: boolean;

  @ApiProperty({ name: 'entries', type: [BrowseEntryDto], description: 'Child directories' })
  @Expose({ name: 'entries' })
  entries!: BrowseEntryDto[];
}

export class CreateFolderDto {
  @ApiProperty({ name: 'parent', type: String, description: 'Existing parent directory (absolute)' })
  @IsString()
  @IsNotEmpty()
  @Expose({ name: 'parent' })
  parent!: string;

  @ApiProperty({ name: 'name', type: String, description: 'New folder name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[^\\/:*?"<>|]+$/, {
    message: 'Folder name contains invalid characters',
  })
  @Expose({ name: 'name' })
  name!: string;
}

export class DirectoryValidationResponseDto {
  @ApiProperty({ name: 'path', type: String, description: 'Absolute path that was validated' })
  @Expose({ name: 'path' })
  path!: string;

  @ApiProperty({ name: 'exists', type: Boolean })
  @Expose({ name: 'exists' })
  exists!: boolean;

  @ApiProperty({ name: 'isDirectory', type: Boolean })
  @Expose({ name: 'isDirectory' })
  isDirectory!: boolean;

  @ApiProperty({ name: 'readable', type: Boolean })
  @Expose({ name: 'readable' })
  readable!: boolean;

  @ApiProperty({ name: 'writable', type: Boolean })
  @Expose({ name: 'writable' })
  writable!: boolean;
}
