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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiExtraModels } from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { McpServerService } from '../services/mcp-server.service';
import { AgentToolkit } from '@/modules/agent/services/agent-toolkit';
import { CreateMcpServerDto, UpdateMcpServerDto, McpServerResponseDto } from '../dto';
import type { McpServerConfig } from '@vinhnt-sdk/mcp';

@ApiTags('MCP Servers')
@ApiExtraModels(CreateMcpServerDto, UpdateMcpServerDto, McpServerResponseDto)
@Controller({ path: 'mcp-servers', version: '1' })
export class McpServerController {
  private readonly logger = new Logger(McpServerController.name);

  constructor(
    private readonly mcpServerService: McpServerService,
    private readonly agentToolkit: AgentToolkit,
  ) {}

  private toMcpConfig(server: {
    name: string;
    transport: string;
    command?: string | null;
    args?: string[] | null;
    url?: string | null;
    env?: Record<string, string> | null;
  }): McpServerConfig {
    return {
      name: server.name,
      transport: server.transport as 'stdio' | 'sse' | 'streamable-http',
      command: server.command ?? undefined,
      args: Array.isArray(server.args) ? server.args : undefined,
      url: server.url ?? undefined,
      env: server.env as Record<string, string> | undefined,
    };
  }

  private async connectNow(server: Awaited<ReturnType<McpServerService['create']>> | null): Promise<void> {
    if (!server?.isEnabled) return;
    try {
      await this.agentToolkit.connectMcpServer(this.toMcpConfig(server));
      await this.mcpServerService.updateConnectionStatus(server.id, 0).catch(() => undefined);
    } catch (error) {
      this.logger.warn(`MCP connect failed for ${server.name}`, error);
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List MCP servers' })
  @ApiDataResponse(McpServerResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<McpServerResponseDto[]>> {
    const servers = await this.mcpServerService.findAll();
    return formatResponse.array(McpServerResponseDto, servers, 'MCP servers retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(McpServerResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<McpServerResponseDto>> {
    const server = await this.mcpServerService.findById(id);
    return formatResponse.single(McpServerResponseDto, server, 'MCP server retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add MCP server' })
  @ApiBody({ type: CreateMcpServerDto })
  @ApiDataResponse(McpServerResponseDto)
  async create(@Body() dto: CreateMcpServerDto): Promise<ApiResponse<McpServerResponseDto>> {
    const server = await this.mcpServerService.create(dto);
    await this.connectNow(server);
    return formatResponse.single(McpServerResponseDto, server, 'MCP server added successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateMcpServerDto })
  @ApiDataResponse(McpServerResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
  ): Promise<ApiResponse<McpServerResponseDto>> {
    const prev = await this.mcpServerService.findById(id).catch(() => null);
    if (prev?.name) {
      await this.agentToolkit.disconnectMcpServer(prev.name).catch(() => undefined);
    }
    const server = await this.mcpServerService.update(id, dto);
    await this.connectNow(server);
    return formatResponse.single(McpServerResponseDto, server, 'MCP server updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    const prev = await this.mcpServerService.findById(id).catch(() => null);
    if (prev?.name) {
      await this.agentToolkit.disconnectMcpServer(prev.name).catch(() => undefined);
    }
    await this.mcpServerService.softDelete(id);
    return formatResponse.single(null, null, 'MCP server removed successfully.');
  }
}
