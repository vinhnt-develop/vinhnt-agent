import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { SessionService } from '../services/session.service';
import { TrajectoryService } from '../services/trajectory.service';
import {
  CreateSessionDto,
  UpdateSessionDto,
  CreateMessageDto,
  SessionResponseDto,
  MessageResponseDto,
  TrajectoryResponseDto,
  ListSessionsDto,
  ListMessagesDto,
} from '../dto';

@ApiTags('Session')
@ApiExtraModels(
  CreateSessionDto,
  UpdateSessionDto,
  CreateMessageDto,
  SessionResponseDto,
  MessageResponseDto,
  TrajectoryResponseDto,
)
@Controller({ path: 'sessions', version: '1' })
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly trajectoryService: TrajectoryService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List sessions in project' })
  @ApiDataResponse(SessionResponseDto, { isArray: true, withMeta: true })
  async findAll(
    @Query() query: ListSessionsDto,
  ): Promise<ApiResponse<SessionResponseDto[]>> {
    const { data, total, page, limit } = await this.sessionService.findAllByProjectWithPagination(query.projectId, query);
    return formatResponse.paginate(
      SessionResponseDto,
      data,
      'Sessions retrieved successfully.',
      page,
      limit,
      total,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get session' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(SessionResponseDto)
  async findOne(
    @Param('id') id: string,
  ): Promise<ApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.findById(id);
    return formatResponse.single(
      SessionResponseDto,
      session,
      'Session retrieved successfully.',
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create session' })
  @ApiBody({ type: CreateSessionDto })
  @ApiDataResponse(SessionResponseDto)
  async create(
    @Body() dto: CreateSessionDto,
  ): Promise<ApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.create(dto);
    return formatResponse.single(
      SessionResponseDto,
      session,
      'Session created successfully.',
    );
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update session' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateSessionDto })
  @ApiDataResponse(SessionResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<ApiResponse<SessionResponseDto>> {
    const session = await this.sessionService.update(id, dto);
    return formatResponse.single(
      SessionResponseDto,
      session,
      'Session updated successfully.',
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete session' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.sessionService.softDelete(id);
    return formatResponse.single(null, null, 'Session deleted successfully.');
  }

  @Get(':id/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List messages in session' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(MessageResponseDto, { isArray: true, withMeta: true })
  async findMessages(
    @Param('id') id: string,
    @Query() query: ListMessagesDto,
  ): Promise<ApiResponse<MessageResponseDto[]>> {
    const { data, total, page, limit } = await this.sessionService.findMessagesWithPagination(id, query);
    return formatResponse.paginate(
      MessageResponseDto,
      data,
      'Messages retrieved successfully.',
      page,
      limit,
      total,
    );
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add message to session' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: CreateMessageDto })
  @ApiDataResponse(MessageResponseDto)
  async addMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ): Promise<ApiResponse<MessageResponseDto>> {
    const message = await this.sessionService.addMessage(id, dto);
    return formatResponse.single(
      MessageResponseDto,
      message,
      'Message added successfully.',
    );
  }

  @Get(':id/trajectory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get session trajectory (runs, tool calls, events, stats)',
  })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(TrajectoryResponseDto)
  async getTrajectory(
    @Param('id') id: string,
  ): Promise<ApiResponse<TrajectoryResponseDto>> {
    const trajectory = await this.trajectoryService.getTrajectory(id);
    return formatResponse.single(
      TrajectoryResponseDto,
      trajectory,
      'Trajectory retrieved successfully.',
    );
  }
}
