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
import { CustomToolService } from '../services/custom-tool.service';
import { AgentToolkit } from '@/modules/agent/services';
import { CreateCustomToolDto, UpdateCustomToolDto, CustomToolResponseDto } from '../dto';

@ApiTags('Custom Tools')
@ApiExtraModels(CreateCustomToolDto, UpdateCustomToolDto, CustomToolResponseDto)
@Controller({ path: 'custom-tools', version: '1' })
export class CustomToolController {
  constructor(
    private readonly customToolService: CustomToolService,
    private readonly agentToolkit: AgentToolkit,
  ) {}

  private async refreshToolkit(): Promise<void> {
    try {
      await this.agentToolkit.loadCustomToolsFromStore();
    } catch {
      /* non-fatal — next kernel build will reload */
    }
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List custom tools' })
  @ApiDataResponse(CustomToolResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<CustomToolResponseDto[]>> {
    const tools = await this.customToolService.findAll();
    return formatResponse.array(CustomToolResponseDto, tools, 'Custom tools retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get custom tool' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(CustomToolResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<CustomToolResponseDto>> {
    const tool = await this.customToolService.findById(id);
    return formatResponse.single(CustomToolResponseDto, tool, 'Custom tool retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create custom tool' })
  @ApiBody({ type: CreateCustomToolDto })
  @ApiDataResponse(CustomToolResponseDto)
  async create(@Body() dto: CreateCustomToolDto): Promise<ApiResponse<CustomToolResponseDto>> {
    const tool = await this.customToolService.create(dto);
    await this.refreshToolkit();
    return formatResponse.single(CustomToolResponseDto, tool, 'Custom tool created successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update custom tool' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateCustomToolDto })
  @ApiDataResponse(CustomToolResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomToolDto,
  ): Promise<ApiResponse<CustomToolResponseDto>> {
    const tool = await this.customToolService.update(id, dto);
    await this.refreshToolkit();
    return formatResponse.single(CustomToolResponseDto, tool, 'Custom tool updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete custom tool' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.customToolService.softDelete(id);
    await this.refreshToolkit();
    return formatResponse.single(null, null, 'Custom tool deleted successfully.');
  }
}
