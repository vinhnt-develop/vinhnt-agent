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
import { KnowledgeService } from '../services/knowledge.service';
import { CreateKnowledgeDto, UpdateKnowledgeDto, KnowledgeResponseDto } from '../dto';

@ApiTags('Knowledge')
@ApiExtraModels(CreateKnowledgeDto, UpdateKnowledgeDto, KnowledgeResponseDto)
@Controller({ path: 'knowledge', version: '1' })
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List knowledge entries' })
  @ApiDataResponse(KnowledgeResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<KnowledgeResponseDto[]>> {
    const entries = await this.knowledgeService.findAll();
    return formatResponse.array(KnowledgeResponseDto, entries, 'Knowledge entries retrieved successfully.');
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Search knowledge entries' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiDataResponse(KnowledgeResponseDto, { isArray: true })
  async search(@Query('q') query: string): Promise<ApiResponse<KnowledgeResponseDto[]>> {
    const entries = await this.knowledgeService.search(query);
    return formatResponse.array(KnowledgeResponseDto, entries, 'Knowledge entries found.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get knowledge entry' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(KnowledgeResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<KnowledgeResponseDto>> {
    const entry = await this.knowledgeService.findById(id);
    return formatResponse.single(KnowledgeResponseDto, entry, 'Knowledge entry retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create knowledge entry' })
  @ApiBody({ type: CreateKnowledgeDto })
  @ApiDataResponse(KnowledgeResponseDto)
  async create(@Body() dto: CreateKnowledgeDto): Promise<ApiResponse<KnowledgeResponseDto>> {
    const entry = await this.knowledgeService.create(dto);
    return formatResponse.single(KnowledgeResponseDto, entry, 'Knowledge entry created successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update knowledge entry' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateKnowledgeDto })
  @ApiDataResponse(KnowledgeResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
  ): Promise<ApiResponse<KnowledgeResponseDto>> {
    const entry = await this.knowledgeService.update(id, dto);
    return formatResponse.single(KnowledgeResponseDto, entry, 'Knowledge entry updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete knowledge entry' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.knowledgeService.softDelete(id);
    return formatResponse.single(null, null, 'Knowledge entry deleted successfully.');
  }
}
