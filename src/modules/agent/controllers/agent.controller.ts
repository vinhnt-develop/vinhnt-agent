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
import type {
  QuestionAnswer,
  QuestionItem,
  PlanApprovalStep,
  ElicitationMode,
  ElicitationRequestedSchema,
} from '@vinhnt-sdk/schema';
import type { QuestionAction, ElicitationAction, PlanDecision } from '@vinhnt-sdk/tools';
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

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an active agent run by runId or sessionId' })
  async cancel(
    @Body() body: { runId?: string; sessionId?: string },
  ): Promise<ApiResponse<{ runId?: string; status: string; cancelled: boolean }>> {
    if (!body?.runId && !body?.sessionId) {
      throw new BadRequestException('runId or sessionId is required');
    }
    const result = await this.agentService.cancelActiveRun(body);
    return {
      status: 'success',
      message: 'Cancel processed.',
      data: result,
    };
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resume a crashed/interrupted run from its durable checkpoint (P4.2)',
  })
  @ApiDataResponse(RunAgentResponseDto)
  async resume(
    @Body() body: { runId: string; prompt?: string; model?: string; provider?: string },
  ): Promise<ApiResponse<RunAgentResponseDto>> {
    if (!body?.runId) {
      throw new BadRequestException('runId is required');
    }
    // sessionId/projectPath are resolved from the persisted run row inside
    // resumeRun; the client may override model/provider for the resumed kernel.
    const settings = this.settingsService.getSettings();
    const result = await this.agentService.resumeRun({
      runId: body.runId,
      prompt: body.prompt ?? '',
      model: body.model,
      provider: body.provider,
      settings,
    });
    return formatResponse.single(
      RunAgentResponseDto,
      result,
      result.status === 'failed' ? 'Resume failed.' : 'Run resumed.',
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
        source: 'system',
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
    scope?: readonly string[];
    source?: string;
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
      ...(r.scope !== undefined ? { scope: r.scope } : {}),
      ...(r.source !== undefined ? { source: r.source } : {}),
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
    @Body() body: { reply: 'once' | 'always' | 'reject'; reason?: string },
  ): Promise<ApiResponse<{ id: string; reply: string; reason?: string }>> {
    if (!body?.reply || !['once', 'always', 'reject'].includes(body.reply)) {
      throw new BadRequestException('reply must be one of: once, always, reject');
    }
    if (body.reason !== undefined && typeof body.reason !== 'string') {
      throw new BadRequestException('reason must be a string when provided');
    }
    const store = this.agentService.getAgentToolkit().getApprovalStore();
    const req = store.getRequest(id);
    if (!req) {
      throw new NotFoundException('Permission request not found or already resolved');
    }
    store.resolveRequest(id, body.reply, body.reason);
    return {
      status: 'success',
      message: 'Permission resolved.',
      data: { id, reply: body.reply, ...(body.reason !== undefined ? { reason: body.reason } : {}) },
    };
  }

  @Get('questions/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List agent questions awaiting a user reply' })
  async getPendingQuestions(): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    sessionId: string;
    questions: readonly QuestionItem[];
    allowCustom?: boolean;
    expiresAt?: number;
  }>>> {
    const store = this.agentService.getAgentToolkit().getQuestionStore();
    const pending = store.pendingRequests().map((r) => ({
      id: r.requestId,
      runId: r.runId,
      sessionId: r.sessionId,
      questions: r.questions,
      ...(r.allowCustom !== undefined ? { allowCustom: r.allowCustom } : {}),
      ...(r.expiresAt !== undefined ? { expiresAt: r.expiresAt } : {}),
    }));
    return {
      status: 'success',
      message: 'Pending questions retrieved.',
      data: pending,
    };
  }

  @Post('questions/:id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Answer a pending agent question' })
  async replyQuestion(
    @Param('id') id: string,
    @Body() body: { action: QuestionAction; answers?: QuestionAnswer[] },
  ): Promise<ApiResponse<{ id: string; action: QuestionAction }>> {
    const valid: QuestionAction[] = ['accept', 'decline', 'cancel'];
    if (!body?.action || !valid.includes(body.action)) {
      throw new BadRequestException('action must be one of: accept, decline, cancel');
    }
    if (body.action === 'accept' && (!body.answers || body.answers.length === 0)) {
      throw new BadRequestException('answers are required when action is "accept"');
    }
    const store = this.agentService.getAgentToolkit().getQuestionStore();
    const req = store.getRequest(id);
    if (!req) {
      throw new NotFoundException('Question request not found or already resolved');
    }
    store.resolveRequest(id, {
      action: body.action,
      ...(body.answers ? { answers: body.answers } : {}),
    });
    return {
      status: 'success',
      message: 'Question resolved.',
      data: { id, action: body.action },
    };
  }

  @Get('elicitations/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List agent elicitation requests awaiting a user reply' })
  async getPendingElicitations(): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    sessionId: string;
    message: string;
    mode: ElicitationMode;
    url?: string;
    requestedSchema?: ElicitationRequestedSchema;
    expiresAt?: number;
  }>>> {
    const store = this.agentService.getAgentToolkit().getElicitationStore();
    const pending = store.pendingRequests().map((r) => ({
      id: r.requestId,
      runId: r.runId,
      sessionId: r.sessionId,
      message: r.message,
      mode: r.mode,
      ...(r.url !== undefined ? { url: r.url } : {}),
      ...(r.requestedSchema !== undefined ? { requestedSchema: r.requestedSchema } : {}),
      ...(r.expiresAt !== undefined ? { expiresAt: r.expiresAt } : {}),
    }));
    return {
      status: 'success',
      message: 'Pending elicitations retrieved.',
      data: pending,
    };
  }

  @Post('elicitations/:id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reply to a pending agent elicitation request' })
  async replyElicitation(
    @Param('id') id: string,
    @Body() body: { action: ElicitationAction; content?: Record<string, unknown> },
  ): Promise<ApiResponse<{ id: string; action: ElicitationAction }>> {
    const valid: ElicitationAction[] = ['accept', 'decline', 'cancel'];
    if (!body?.action || !valid.includes(body.action)) {
      throw new BadRequestException('action must be one of: accept, decline, cancel');
    }
    const store = this.agentService.getAgentToolkit().getElicitationStore();
    const req = store.getRequest(id);
    if (!req) {
      throw new NotFoundException('Elicitation request not found or already resolved');
    }
    store.resolveRequest(id, {
      action: body.action,
      ...(body.content ? { content: body.content } : {}),
    });
    return {
      status: 'success',
      message: 'Elicitation resolved.',
      data: { id, action: body.action },
    };
  }

  @Get('plans/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List agent plans awaiting a user decision' })
  async getPendingPlans(): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    sessionId: string;
    title?: string;
    steps: readonly PlanApprovalStep[];
    explanation?: string;
    expiresAt?: number;
  }>>> {
    const store = this.agentService.getAgentToolkit().getPlanApprovalStore();
    const pending = store.pendingRequests().map((r) => ({
      id: r.requestId,
      runId: r.runId,
      sessionId: r.sessionId,
      ...(r.title !== undefined ? { title: r.title } : {}),
      steps: r.steps,
      ...(r.explanation !== undefined ? { explanation: r.explanation } : {}),
      ...(r.expiresAt !== undefined ? { expiresAt: r.expiresAt } : {}),
    }));
    return {
      status: 'success',
      message: 'Pending plans retrieved.',
      data: pending,
    };
  }

  @Post('plans/:id/decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or request changes to a pending agent plan' })
  async decidePlan(
    @Param('id') id: string,
    @Body() body: { decision: PlanDecision; feedback?: string },
  ): Promise<ApiResponse<{ id: string; decision: PlanDecision }>> {
    const valid: PlanDecision[] = ['approve', 'request_changes', 'cancel'];
    if (!body?.decision || !valid.includes(body.decision)) {
      throw new BadRequestException('decision must be one of: approve, request_changes, cancel');
    }
    const store = this.agentService.getAgentToolkit().getPlanApprovalStore();
    const req = store.getRequest(id);
    if (!req) {
      throw new NotFoundException('Plan request not found or already resolved');
    }
    store.resolveRequest(id, {
      decision: body.decision,
      ...(body.feedback ? { feedback: body.feedback } : {}),
    });
    return {
      status: 'success',
      message: 'Plan decision recorded.',
      data: { id, decision: body.decision },
    };
  }
}
