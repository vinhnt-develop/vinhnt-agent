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
import { WorkspaceService } from '../services/workspace.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceResponseDto } from '../dto';

@ApiTags('Workspace')
@ApiExtraModels(CreateWorkspaceDto, UpdateWorkspaceDto)
@Controller({ path: 'workspaces', version: '1' })
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create workspace' })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiDataResponse(null)
  async create(@Body() dto: CreateWorkspaceDto): Promise<ApiResponse<null>> {
    const userId = 'local-user';
    await this.workspaceService.create({
      name: dto.name,
      description: dto.description,
      ownerId: userId,
    });
    return formatResponse.single(null, null, 'Workspace created successfully.');
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List workspaces' })
  @ApiDataResponse(WorkspaceResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<WorkspaceResponseDto[]>> {
    const userId = 'local-user';
    const workspaces = await this.workspaceService.findAllByOwner(userId);
    return formatResponse.array(WorkspaceResponseDto, workspaces, 'Workspaces retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get workspace' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(WorkspaceResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<WorkspaceResponseDto>> {
    const userId = 'local-user';
    const workspace = await this.workspaceService.findById(id, userId);
    return formatResponse.single(WorkspaceResponseDto, workspace, 'Workspace retrieved successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update workspace' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateWorkspaceDto })
  @ApiDataResponse(WorkspaceResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<ApiResponse<WorkspaceResponseDto>> {
    const userId = 'local-user';
    const workspace = await this.workspaceService.update(id, dto, userId);
    return formatResponse.single(WorkspaceResponseDto, workspace, 'Workspace updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete workspace' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    const userId = 'local-user';
    await this.workspaceService.softDelete(id, userId);
    return formatResponse.single(null, null, 'Workspace deleted successfully.');
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set workspace as active' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(WorkspaceResponseDto)
  async activate(@Param('id') id: string): Promise<ApiResponse<WorkspaceResponseDto>> {
    const userId = 'local-user';
    const workspace = await this.workspaceService.setActive(id, userId);
    return formatResponse.single(WorkspaceResponseDto, workspace, 'Workspace activated successfully.');
  }
}
