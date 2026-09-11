import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiExtraModels } from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { ToolConfigService } from '../services/tool-config.service';
import { CreateToolConfigDto, UpdateToolConfigDto, ToolConfigResponseDto } from '../dto';

const BUILTIN_TOOL_CATALOG = [
  { id: 'read_file', name: 'Read File', description: 'Read contents of a file', category: 'file', risk: 'safe' as const, hasConfig: false },
  { id: 'write_file', name: 'Write File', description: 'Write content to a file', category: 'file', risk: 'moderate' as const, hasConfig: false },
  { id: 'edit_file', name: 'Edit File', description: 'Edit a file with string replacements', category: 'file', risk: 'moderate' as const, hasConfig: false },
  { id: 'list_files', name: 'List Files', description: 'List files and directories', category: 'file', risk: 'safe' as const, hasConfig: false },
  { id: 'search_files', name: 'Search Files', description: 'Search for files by pattern', category: 'search', risk: 'safe' as const, hasConfig: false },
  { id: 'grep', name: 'Grep', description: 'Search file contents with regex', category: 'search', risk: 'safe' as const, hasConfig: false },
  { id: 'run_shell', name: 'Run Shell', description: 'Execute a shell command', category: 'shell', risk: 'dangerous' as const, hasConfig: true },
  { id: 'git_status', name: 'Git Status', description: 'Show working tree status', category: 'git', risk: 'safe' as const, hasConfig: false },
  { id: 'git_diff', name: 'Git Diff', description: 'Show file differences', category: 'git', risk: 'safe' as const, hasConfig: false },
  { id: 'git_log', name: 'Git Log', description: 'Show commit history', category: 'git', risk: 'safe' as const, hasConfig: false },
  { id: 'web_fetch', name: 'Web Fetch', description: 'Fetch content from a URL', category: 'web', risk: 'moderate' as const, hasConfig: false },
  { id: 'web_search', name: 'Web Search', description: 'Search the web', category: 'web', risk: 'safe' as const, hasConfig: false },
];

@ApiTags('Tool Config')
@ApiExtraModels(CreateToolConfigDto, UpdateToolConfigDto, ToolConfigResponseDto)
@Controller({ path: 'tools', version: '1' })
export class ToolConfigController {
  constructor(private readonly toolConfigService: ToolConfigService) {}

  @Get('catalog')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available builtin tools' })
  async getCatalog(): Promise<ApiResponse<typeof BUILTIN_TOOL_CATALOG>> {
    return formatResponse.single(null, BUILTIN_TOOL_CATALOG, 'Tool catalog retrieved successfully.');
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tool configs' })
  @ApiDataResponse(ToolConfigResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<ToolConfigResponseDto[]>> {
    const configs = await this.toolConfigService.findAll();
    return formatResponse.array(ToolConfigResponseDto, configs, 'Tool configs retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get tool config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(ToolConfigResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<ToolConfigResponseDto>> {
    const config = await this.toolConfigService.findById(id);
    return formatResponse.single(ToolConfigResponseDto, config, 'Tool config retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create tool config' })
  @ApiBody({ type: CreateToolConfigDto })
  @ApiDataResponse(ToolConfigResponseDto)
  async create(@Body() dto: CreateToolConfigDto): Promise<ApiResponse<ToolConfigResponseDto>> {
    const config = await this.toolConfigService.create(dto);
    return formatResponse.single(ToolConfigResponseDto, config, 'Tool config created successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update tool config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateToolConfigDto })
  @ApiDataResponse(ToolConfigResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateToolConfigDto,
  ): Promise<ApiResponse<ToolConfigResponseDto>> {
    const config = await this.toolConfigService.update(id, dto);
    return formatResponse.single(ToolConfigResponseDto, config, 'Tool config updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete tool config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.toolConfigService.softDelete(id);
    return formatResponse.single(null, null, 'Tool config deleted successfully.');
  }
}
