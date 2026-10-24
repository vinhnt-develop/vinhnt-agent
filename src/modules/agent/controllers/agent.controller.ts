import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UploadedFile,
  UseInterceptors,
  Logger,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiConsumes,
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
import {
  AgentService,
  AgentSettingsService,
  AttachmentService,
  MAX_UPLOAD_BYTES,
  type UploadedFileInput,
  type SavedUpload,
} from '../services';
import { RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto } from '../dto';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectPathService, projectDirectoryError } from '@/shared/project-path.service';

@ApiTags('Agent')
@ApiExtraModels(RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto)
@Controller({ path: 'agent', version: '1' })
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly settingsService: AgentSettingsService,
    private readonly sessionRepository: SessionRepository,
    private readonly projectPathService: ProjectPathService,
    private readonly attachmentService: AttachmentService,
  ) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run agent with a prompt in a session' })
  @ApiBody({ type: RunAgentDto })
  @ApiDataResponse(RunAgentResponseDto)
  async run(
    @Body() dto: RunAgentDto,
    @Req() req: { user?: { id?: string; sub?: string; appId?: string; tenantId?: string } },
  ): Promise<ApiResponse<RunAgentResponseDto>> {
    const session = await this.sessionRepository.findById(dto.sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const resolved = await this.projectPathService.resolveDetails(dto.sessionId);
    if (resolved.status !== 'ok') {
      throw new ConflictException(projectDirectoryError(resolved));
    }
    const projectPath = resolved.source === 'project' ? resolved.path : undefined;

    // Same settings source as WS gateway (saved kernel settings).
    const settings = this.settingsService.getSettings();

    const result = await this.agentService.runAgent({
      sessionId: dto.sessionId,
      prompt: dto.prompt,
      actorId: req.user?.id ?? req.user?.sub,
      appId: req.user?.appId ?? req.user?.tenantId,
      model: dto.model,
      provider: dto.provider,
      projectPath,
      permissionMode: dto.permissionMode,
      selection: dto.selection,
      attachments: dto.attachments,
      images: dto.images,
      settings,
    });
    return formatResponse.single(
      RunAgentResponseDto,
      result,
      'Agent run completed.',
    );
  }

  @Post('uploads')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file into the session project' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'file'],
      properties: {
        sessionId: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async upload(
    @Body() body: { sessionId?: string },
    @UploadedFile() file?: UploadedFileInput,
  ): Promise<ApiResponse<SavedUpload>> {
    if (!body?.sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const session = await this.sessionRepository.findById(body.sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const resolved = await this.projectPathService.resolveDetails(body.sessionId);
    if (resolved.status !== 'ok') {
      throw new ConflictException(projectDirectoryError(resolved));
    }
    const data = await this.attachmentService.saveUpload(
      file,
      resolved.path,
      body.sessionId,
    );
    return {
      status: 'success',
      message: 'File uploaded.',
      data,
    };
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
    @Req() req: { user?: { id?: string; sub?: string } },
  ): Promise<ApiResponse<RunAgentResponseDto>> {
    if (!body?.runId) {
      throw new BadRequestException('runId is required');
    }
    const run = this.agentService.getRunInfo(body.runId);
    const projectPath = await this.resolveRunProjectPath(run?.sessionId ?? undefined);
    const settings = this.settingsService.getSettings();
    const result = await this.agentService.resumeRun({
      runId: body.runId,
      prompt: body.prompt?.trim() ?? 'Please continue from where you left off.',
      actorId: req.user?.id ?? req.user?.sub,
      model: body.model,
      provider: body.provider,
      projectPath,
      settings,
    });
    return formatResponse.single(
      RunAgentResponseDto,
      result,
      result.status === 'failed' ? 'Resume failed.' : 'Run resumed.',
    );
  }

  private async resolveRunProjectPath(
    sessionId?: string,
  ): Promise<string | undefined> {
    if (!sessionId) return undefined;
    const resolved = await this.projectPathService.resolveDetails(sessionId);
    if (resolved.status !== 'ok') {
      throw new ConflictException(projectDirectoryError(resolved));
    }
    return resolved.source === 'project' ? resolved.path : undefined;
  }

  @Get('runs/resumable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the latest interrupted run for a session' })
  async getResumableRun(
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<{
    runId: string;
    sessionId: string;
    startedAt?: string;
    model?: string;
    provider?: string;
  } | null>> {
    if (!sessionId) {
      throw new BadRequestException('sessionId is required');
    }
    return {
      status: 'success',
      data: this.agentService.getResumableRun(sessionId),
    };
  }

  @Get('runs/:runId/snapshots')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List file snapshots captured by a run' })
  async getRunSnapshots(@Param('runId') runId: string): Promise<ApiResponse<Array<{
    path: string;
    existed: boolean;
    size: number;
    toolCallId: string;
    toolName: string;
    step: number;
    at: string;
    undone: boolean;
  }>>> {
    const snapshots = this.agentService.getRunFileSnapshots(runId);
    if (snapshots === null) {
      throw new NotFoundException('Run snapshots are no longer available');
    }
    return {
      status: 'success',
      message: 'Snapshots retrieved.',
      data: snapshots,
    };
  }

  @Post('runs/:runId/undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo file changes made by a run' })
  async undoRun(@Param('runId') runId: string): Promise<ApiResponse<{
    restored: unknown[];
    skipped: unknown[];
  }>> {
    const result = await this.agentService.undoRunFiles(runId);
    if (result === null) {
      throw new NotFoundException('Run snapshots are no longer available');
    }
    return {
      status: 'success',
      message: 'Run files restored.',
      data: result,
    };
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
  async getPendingPermissions(
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    sessionId?: string | null;
    toolName: string;
    resource: string;
    reason: string;
    prompt: string;
    occurredAt: string;
    scope?: readonly string[];
    source?: string;
  }>>> {
    const store = this.agentService.getAgentToolkit().getApprovalStore();
    const pending = store
      .pendingRequests()
      .map((r) => ({
        id: r.id,
        runId: r.runId,
        sessionId: this.agentService.getRunInfo(r.runId)?.sessionId ?? null,
        toolName: r.toolName,
        resource: r.resource,
        reason: r.reason,
        prompt: r.prompt,
        occurredAt: r.occurredAt,
        ...(r.scope !== undefined ? { scope: r.scope } : {}),
        ...(r.source !== undefined ? { source: r.source } : {}),
      }))
      .filter((r) => !sessionId || r.sessionId === sessionId);
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
    this.resumeAfterHitl(req.runId);
    return {
      status: 'success',
      message: 'Permission resolved.',
      data: { id, reply: body.reply, ...(body.reason !== undefined ? { reason: body.reason } : {}) },
    };
  }

  @Get('questions/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List agent questions awaiting a user reply' })
  async getPendingQuestions(
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    sessionId: string;
    questions: readonly QuestionItem[];
    allowCustom?: boolean;
    expiresAt?: number;
  }>>> {
    const store = this.agentService.getAgentToolkit().getQuestionStore();
    const pending = store
      .pendingRequests()
      .filter((r) => !sessionId || r.sessionId === sessionId)
      .map((r) => ({
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
    this.resumeAfterHitl(req.runId, req.sessionId);
    return {
      status: 'success',
      message: 'Question resolved.',
      data: { id, action: body.action },
    };
  }

  @Get('elicitations/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List agent elicitation requests awaiting a user reply' })
  async getPendingElicitations(
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<Array<{
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
    const pending = store.pendingRequests(undefined, sessionId).map((r) => ({
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
      if (store.wasSettled(id)) {
        throw new ConflictException({
          error: 'already_resolved',
          errorCode: 'already_resolved',
          message: 'Elicitation request already resolved.',
        });
      }
      throw new NotFoundException({
        error: 'elicitation_not_found',
        errorCode: 'elicitation_not_found',
        message: 'Elicitation request not found.',
      });
    }
    store.resolveRequest(id, {
      action: body.action,
      ...(body.content ? { content: body.content } : {}),
    });
    this.resumeAfterHitl(req.runId, req.sessionId);
    return {
      status: 'success',
      message: 'Elicitation resolved.',
      data: { id, action: body.action },
    };
  }

  @Get('sessions/:id/surfaces')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List persisted generative-UI surfaces for a session' })
  async getSessionSurfaces(
    @Param('id') id: string,
  ): Promise<ApiResponse<Array<{
    surfaceId: string;
    surface: unknown;
    updatedAt: string;
  }>>> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const rows = await this.sessionRepository.findSurfaces(id);
    return {
      status: 'success',
      message: 'Session surfaces retrieved.',
      data: rows.map((row) => ({
        surfaceId: row.surfaceId,
        surface: row.payload,
        updatedAt: row.updatedAt,
      })),
    };
  }

  @Delete('sessions/:id/surfaces/:surfaceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss one persisted generative-UI surface' })
  async deleteSessionSurface(
    @Param('id') id: string,
    @Param('surfaceId') surfaceId: string,
  ): Promise<ApiResponse<{ surfaceId: string; deleted: number }>> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const result = await this.sessionRepository.deleteSurface(id, surfaceId);
    return {
      status: 'success',
      message: 'Surface dismissed.',
      data: { surfaceId, deleted: result.changes ?? 0 },
    };
  }

  @Delete('sessions/:id/surfaces')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss all persisted generative-UI surfaces for a session' })
  async deleteSessionSurfaces(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ deleted: number }>> {
    const session = await this.sessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    const result = await this.sessionRepository.deleteSurfaces(id);
    return {
      status: 'success',
      message: 'Surfaces cleared.',
      data: { deleted: result.changes ?? 0 },
    };
  }

  @Get('plans/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List agent plans awaiting a user decision' })
  async getPendingPlans(
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiResponse<Array<{
    id: string;
    runId: string;
    sessionId: string;
    title?: string;
    steps: readonly PlanApprovalStep[];
    explanation?: string;
    expiresAt?: number;
  }>>> {
    const store = this.agentService.getAgentToolkit().getPlanApprovalStore();
    const pending = store
      .pendingRequests()
      .filter((r) => !sessionId || r.sessionId === sessionId)
      .map((r) => ({
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
    this.resumeAfterHitl(req.runId, req.sessionId);
    return {
      status: 'success',
      message: 'Plan decision recorded.',
      data: { id, decision: body.decision },
    };
  }

  private resumeAfterHitl(runId: string, sessionId?: string): void {
    try {
      const resolvedSessionId =
        sessionId ?? this.agentService.getRunInfo?.(runId)?.sessionId ?? undefined;
      void this.resolveRunProjectPath(resolvedSessionId)
        .then((projectPath) => {
          this.agentService.resumeRunAfterHitl?.({
            runId,
            projectPath,
            settings: this.settingsService.getSettings(),
          });
        })
        .catch((error: unknown) => {
          this.logger.warn(`Could not auto-resume run ${runId} after HITL: ${error}`);
        });
    } catch (error) {
      this.logger.warn(`Could not auto-resume run ${runId} after HITL: ${error}`);
    }
  }
}
