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
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiQuery, ApiExtraModels } from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { ProjectService } from '../services/project.service';
import { CreateProjectDto, UpdateProjectDto, ProjectResponseDto } from '../dto';

@ApiTags('Project')
@ApiExtraModels(CreateProjectDto, UpdateProjectDto)
@Controller({ path: 'projects', version: '1' })
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List projects in workspace' })
  @ApiQuery({ name: 'workspaceId', required: true, type: String })
  @ApiDataResponse(ProjectResponseDto, { isArray: true })
  async findAll(@Query('workspaceId') workspaceId: string): Promise<ApiResponse<ProjectResponseDto[]>> {
    const projects = await this.projectService.findAllByWorkspace(workspaceId);
    return formatResponse.array(ProjectResponseDto, projects, 'Projects retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get project' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(ProjectResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<ProjectResponseDto>> {
    const project = await this.projectService.findById(id);
    return formatResponse.single(ProjectResponseDto, project, 'Project retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create project' })
  @ApiBody({ type: CreateProjectDto })
  @ApiDataResponse(ProjectResponseDto)
  async create(@Body() dto: CreateProjectDto): Promise<ApiResponse<ProjectResponseDto>> {
    const project = await this.projectService.create(dto);
    return formatResponse.single(ProjectResponseDto, project, 'Project created successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiDataResponse(ProjectResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ApiResponse<ProjectResponseDto>> {
    const project = await this.projectService.update(id, dto);
    return formatResponse.single(ProjectResponseDto, project, 'Project updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete project' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.projectService.softDelete(id);
    return formatResponse.single(null, null, 'Project deleted successfully.');
  }
}
