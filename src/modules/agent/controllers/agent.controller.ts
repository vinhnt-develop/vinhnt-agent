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

@ApiTags('Agent')
@ApiExtraModels(RunAgentDto, RunAgentResponseDto, AgentStatsResponseDto)
@Controller({ path: 'agent', version: '1' })
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly sessionRepository: SessionRepository,
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

    const result = await this.agentService.runAgent({
      sessionId: dto.sessionId,
      prompt: dto.prompt,
      model: dto.model,
      provider: dto.provider,
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
}
