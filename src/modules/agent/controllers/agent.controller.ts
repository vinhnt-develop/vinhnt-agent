import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { AgentService } from '../services';
import { RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto } from '../dto';
import { SessionRepository } from '@/modules/session/repositories/session.repository';
import { ProjectRepository } from '@/modules/project/repositories/project.repository';
import { WorkspaceRepository } from '@/modules/workspace/repositories/workspace.repository';

@ApiTags('Agent')
@ApiExtraModels(RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto)
@Controller({ path: 'agent', version: '1' })
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly sessionRepository: SessionRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  private async resolveProjectPath(sessionId: string): Promise<string | undefined> {
    try {
      const session = await this.sessionRepository.findById(sessionId);
      if (!session?.projectId) return undefined;

      const project = await this.projectRepository.findById(session.projectId);
      if (!project) return undefined;

      if (project.directory) return project.directory;

      if (project.workspaceId) {
        const workspace = await this.workspaceRepository.findById(project.workspaceId);
        if (workspace?.directory) {
          const path = await import('node:path');
          return path.default.join(workspace.directory, project.name);
        }
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

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

    const projectPath = await this.resolveProjectPath(dto.sessionId);

    const result = await this.agentService.runAgent({
      sessionId: dto.sessionId,
      prompt: dto.prompt,
      model: dto.model,
      provider: dto.provider,
      projectPath,
      selection: dto.selection,
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
    const tools = defs.map((t: any) => ({
      id: t.id || t.name,
      name: t.name || t.id,
      description: t.description || '',
      risk: t.risk || 'read-only',
      source: (t.metadata?.source as string) || (String(t.id || '').startsWith('custom_') ? 'custom' : String(t.id || '').startsWith('mcp__') ? 'mcp' : 'system'),
    }));
    return {
      status: 'success',
      message: 'Tools retrieved successfully.',
      data: tools,
    };
  }
}
