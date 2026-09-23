import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
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
import { ProjectPathService } from '@/shared/project-path.service';

@ApiTags('File Explorer')
@ApiExtraModels(FileTreeNodeResponseDto, FileContentResponseDto)
@Controller({ path: 'files', version: '1' })
export class FileExplorerController {
  constructor(
    private readonly fileExplorerService: FileExplorerService,
    private readonly projectPathService: ProjectPathService,
  ) {}

  @Get('tree')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List directory contents' })
  @ApiQuery({
    name: 'path',
    required: false,
    type: 'string',
    description: 'Absolute path or relative path from workspace root',
  })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    type: 'string',
    description: 'Optional session to resolve project path',
  })
  @ApiDataResponse(FileTreeNodeResponseDto, { isArray: true })
  async getTree(
    @Query('path') requestedPath?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<FileTreeNodeResponseDto[]>> {
    const rootDir = await this.projectPathService.resolveOrFallback(sessionId);
    // No path → list workspace root. Has path → use it directly (absolute).
    const dirToList = requestedPath || rootDir;
    const nodes = await this.fileExplorerService.getTree(rootDir, dirToList);

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
  @ApiQuery({
    name: 'sessionId',
    required: false,
    type: 'string',
    description: 'Optional session to resolve project path',
  })
  @ApiDataResponse(FileContentResponseDto)
  async getContent(
    @Query('path') requestedPath: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<FileContentResponseDto>> {
    if (!requestedPath) {
      throw new BadRequestException('path query parameter is required');
    }

    const rootDir = await this.projectPathService.resolveOrFallback(sessionId);
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
