import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { AgentService, AgentSettingsService } from '../services';
import { RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto } from '../dto';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectPathService } from '@/shared/project-path.service';

@ApiTags('Agent')
@ApiExtraModels(RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto)
@Controller({ path: 'agent', version: '1' })
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly settingsService: AgentSettingsService,
    private readonly sessionRepository: SessionRepository,
    private readonly projectPathService: ProjectPathService,
  ) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run agent with a prompt in a session' })
  @ApiBody({ type: RunAgentDto })
  @ApiDataResponse(RunAgentResponseDto)
  async run(
    @Body() dto: RunAgentDto,
  ): Promise<ApiResponse<RunAgentResponseDto>> {
    const session = await this.sessionRepository.findById(dto.sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const projectPath = await this.projectPathService.resolve(dto.sessionId);

    // Same settings source as WS gateway (saved kernel settings).
    const settings = this.settingsService.getSettings();

    const result = await this.agentService.runAgent({
      sessionId: dto.sessionId,
      prompt: dto.prompt,
      model: dto.model,
      provider: dto.provider,
      projectPath,
      permissionMode: dto.permissionMode,
      selection: dto.selection,
      settings,
    });
    return formatResponse.single(
      RunAgentResponseDto,
      result,
      'Agent run completed.',
    );
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get agent run statistics' })
  @ApiDataResponse(AgentStatsResponseDto)
  async getStats(): Promise<ApiResponse<AgentStatsResponseDto>> {
    const stats = await this.agentService.getRunStats();
    return formatResponse.single(AgentStatsResponseDto, stats, 'Stats retrieved successfully.');
  }

  @Get('tools')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available agent tools' })
  async getTools(): Promise<ApiResponse<Array<{ id: string; name: string; description: string; risk: string; source: string }>>> {
    const toolkit = this.agentService.getAgentToolkit();
    const defs = toolkit.getToolsAsDefinitions();
    const mapTool = (t: any) => ({
      id: t.id || t.name,
      name: t.name || t.id,
      description: t.description || '',
      risk: t.risk || 'read-only',
      source: (t.metadata?.source as string) || (String(t.id || '').startsWith('custom_') ? 'custom' : String(t.id || '').startsWith('mcp__') ? 'mcp' : 'system'),
    });
    const tools = defs.map(mapTool);
    // memory_search is appended at kernel build time, not in the toolkit registry
    if (!tools.some((t) => t.id === 'memory_search')) {
      tools.push({
        id: 'memory_search',
        name: 'memory_search',
        description: 'Search past conversations by keyword.',
        risk: 'read',
        source: 'knowledge',
      });
    }
    return {
      status: 'success',
      message: 'Tools retrieved successfully.',
      data: tools,
    };
  }

  @Get('permissions/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List pending tool-approval requests' })
  async getPendingPermissions(): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    toolName: string;
    resource: string;
    reason: string;
    prompt: string;
    occurredAt: string;
  }>>> {
    const store = this.agentService.getAgentToolkit().getApprovalStore();
    const pending = store.pendingRequests().map((r) => ({
      id: r.id,
      runId: r.runId,
      toolName: r.toolName,
      resource: r.resource,
      reason: r.reason,
      prompt: r.prompt,
      occurredAt: r.occurredAt,
    }));
    return {
      status: 'success',
      message: 'Pending permissions retrieved.',
      data: pending,
    };
  }

  @Post('permissions/:id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a pending tool-approval request' })
  async replyPermission(
    @Param('id') id: string,
    @Body() body: { reply: 'once' | 'always' | 'reject' },
  ): Promise<ApiResponse<{ id: string; reply: string }>> {
    if (!body?.reply || !['once', 'always', 'reject'].includes(body.reply)) {
      throw new BadRequestException('reply must be one of: once, always, reject');
    }
    const store = this.agentService.getAgentToolkit().getApprovalStore();
    const req = store.getRequest(id);
    if (!req) {
      throw new NotFoundException('Permission request not found or already resolved');
    }
    store.resolveRequest(id, body.reply);
    return {
      status: 'success',
      message: 'Permission resolved.',
      data: { id, reply: body.reply },
    };
  }
}
