import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { GitExplorerService } from '../services';
import {
  GitStatusFileResponseDto,
  GitLogEntryResponseDto,
  GitDiffResponseDto,
} from '../dto';
import { GitDiffQueryDto, GitLogQueryDto } from '../dto';

@ApiTags('Git Explorer')
@ApiExtraModels(GitDiffQueryDto, GitLogQueryDto, GitStatusFileResponseDto, GitLogEntryResponseDto, GitDiffResponseDto)
@Controller({ path: 'git', version: '1' })
export class GitExplorerController {
  constructor(
    private readonly gitExplorerService: GitExplorerService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get git status of changed files' })
  @ApiDataResponse(GitStatusFileResponseDto, { isArray: true })
  async getStatus(): Promise<ApiResponse<GitStatusFileResponseDto[]>> {
    const rootDir = this.configService.get<string>('agent.workspaceRoot', '.');
    const files = await this.gitExplorerService.getStatus(rootDir);

    return formatResponse.array(
      GitStatusFileResponseDto,
      files,
      'Git status retrieved successfully.',
    );
  }

  @Get('diff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get git diff' })
  @ApiDataResponse(GitDiffResponseDto)
  async getDiff(
    @Query() query: GitDiffQueryDto,
  ): Promise<ApiResponse<GitDiffResponseDto>> {
    const rootDir = this.configService.get<string>('agent.workspaceRoot', '.');
    const diff = await this.gitExplorerService.getDiff(rootDir, query.path);

    return formatResponse.single(GitDiffResponseDto, { diff }, 'Git diff retrieved successfully.');
  }

  @Get('diff/staged')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get staged git diff' })
  @ApiDataResponse(GitDiffResponseDto)
  async getDiffStaged(
    @Query() query: GitDiffQueryDto,
  ): Promise<ApiResponse<GitDiffResponseDto>> {
    const rootDir = this.configService.get<string>('agent.workspaceRoot', '.');
    const diff = await this.gitExplorerService.getDiffStaged(
      rootDir,
      query.path,
    );

    return formatResponse.single(
      GitDiffResponseDto,
      { diff },
      'Staged git diff retrieved successfully.',
    );
  }

  @Get('log')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get git log' })
  @ApiDataResponse(GitLogEntryResponseDto, { isArray: true })
  async getLog(
    @Query() query: GitLogQueryDto,
  ): Promise<ApiResponse<GitLogEntryResponseDto[]>> {
    const rootDir = this.configService.get<string>('agent.workspaceRoot', '.');
    const entries = await this.gitExplorerService.getLog(
      rootDir,
      query.limit || 20,
    );

    return formatResponse.array(
      GitLogEntryResponseDto,
      entries,
      'Git log retrieved successfully.',
    );
  }
}
