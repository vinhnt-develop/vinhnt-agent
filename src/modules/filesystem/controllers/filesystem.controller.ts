import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import {
  BrowseRootResponseDto,
  CreateFolderDto,
  DirectoryListResponseDto,
  DirectoryValidationResponseDto,
} from '../dto';
import { FilesystemService } from '../services';

@ApiTags('Filesystem')
@ApiExtraModels(
  BrowseRootResponseDto,
  DirectoryListResponseDto,
  DirectoryValidationResponseDto,
)
@Controller({ path: 'fs', version: '1' })
export class FilesystemController {
  constructor(private readonly filesystemService: FilesystemService) {}

  @Get('roots')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List directories that may be browsed' })
  @ApiDataResponse(BrowseRootResponseDto, { isArray: true })
  async getRoots(): Promise<ApiResponse<BrowseRootResponseDto[]>> {
    const roots = await this.filesystemService.getRoots();
    return formatResponse.array(
      BrowseRootResponseDto,
      roots,
      'Browse roots retrieved successfully.',
    );
  }

  @Get('list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List child directories of an allowed path' })
  @ApiQuery({
    name: 'path',
    required: false,
    type: 'string',
    description: 'Absolute path (defaults to the workspace root)',
  })
  @ApiDataResponse(DirectoryListResponseDto)
  async list(
    @Query('path') requestedPath?: string,
  ): Promise<ApiResponse<DirectoryListResponseDto>> {
    const result = await this.filesystemService.listDirectories(requestedPath);
    return formatResponse.single(
      DirectoryListResponseDto,
      result,
      'Directories retrieved successfully.',
    );
  }

  @Get('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check whether a directory exists and is usable' })
  @ApiQuery({ name: 'path', required: true, type: 'string' })
  @ApiDataResponse(DirectoryValidationResponseDto)
  async validate(
    @Query('path') requestedPath: string,
  ): Promise<ApiResponse<DirectoryValidationResponseDto>> {
    const result = await this.filesystemService.validateDirectory(
      requestedPath ?? '',
    );
    return formatResponse.single(
      DirectoryValidationResponseDto,
      result,
      'Directory validated successfully.',
    );
  }

  @Post('folders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a folder inside an allowed path' })
  @ApiBody({ type: CreateFolderDto })
  @ApiDataResponse(DirectoryValidationResponseDto)
  async createFolder(
    @Body() dto: CreateFolderDto,
  ): Promise<ApiResponse<{ path: string }>> {
    const result = await this.filesystemService.createFolder(
      dto.parent,
      dto.name,
    );
    return formatResponse.single(null, result, 'Folder created successfully.');
  }
}
