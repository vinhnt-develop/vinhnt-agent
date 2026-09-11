import {
  Controller,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { FileExplorerService } from '../services';
import {
  FileTreeNodeResponseDto,
  FileContentResponseDto,
} from '../dto';

@ApiTags('File Explorer')
@ApiExtraModels(FileTreeNodeResponseDto, FileContentResponseDto)
@Controller({ path: 'files', version: '1' })
export class FileExplorerController {
  constructor(
    private readonly fileExplorerService: FileExplorerService,
    private readonly configService: ConfigService,
  ) {}

  @Get('tree')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List directory contents' })
  @ApiQuery({
    name: 'path',
    required: false,
    type: 'string',
    description: 'Relative path from workspace root',
  })
  @ApiDataResponse(FileTreeNodeResponseDto, { isArray: true })
  async getTree(
    @Query('path') requestedPath?: string,
  ): Promise<ApiResponse<FileTreeNodeResponseDto[]>> {
    const rootDir = this.configService.getOrThrow<string>('WORKSPACE_ROOT');
    const nodes = await this.fileExplorerService.getTree(
      rootDir,
      requestedPath || '.',
    );

    return formatResponse.array(
      FileTreeNodeResponseDto,
      nodes,
      'Directory contents retrieved successfully.',
    );
  }

  @Get('content')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Read file content' })
  @ApiQuery({
    name: 'path',
    required: true,
    type: 'string',
    description: 'Relative path to the file',
  })
  @ApiDataResponse(FileContentResponseDto)
  async getContent(
    @Query('path') requestedPath: string,
  ): Promise<ApiResponse<FileContentResponseDto>> {
    if (!requestedPath) {
      throw new BadRequestException('path query parameter is required');
    }

    const rootDir = this.configService.getOrThrow<string>('WORKSPACE_ROOT');
    const result = await this.fileExplorerService.getFileContent(
      rootDir,
      requestedPath,
    );

    return formatResponse.single(
      FileContentResponseDto,
      result,
      'File content retrieved successfully.',
    );
  }
}
