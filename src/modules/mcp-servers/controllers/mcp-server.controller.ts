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
import { McpServerService } from '../services/mcp-server.service';
import { CreateMcpServerDto, UpdateMcpServerDto, McpServerResponseDto } from '../dto';

@ApiTags('MCP Servers')
@ApiExtraModels(CreateMcpServerDto, UpdateMcpServerDto, McpServerResponseDto)
@Controller({ path: 'mcp-servers', version: '1' })
export class McpServerController {
  constructor(private readonly mcpServerService: McpServerService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List MCP servers' })
  @ApiDataResponse(McpServerResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<McpServerResponseDto[]>> {
    const servers = await this.mcpServerService.findAll();
    return formatResponse.array(McpServerResponseDto, servers, 'MCP servers retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(McpServerResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<McpServerResponseDto>> {
    const server = await this.mcpServerService.findById(id);
    return formatResponse.single(McpServerResponseDto, server, 'MCP server retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add MCP server' })
  @ApiBody({ type: CreateMcpServerDto })
  @ApiDataResponse(McpServerResponseDto)
  async create(@Body() dto: CreateMcpServerDto): Promise<ApiResponse<McpServerResponseDto>> {
    const server = await this.mcpServerService.create(dto);
    return formatResponse.single(McpServerResponseDto, server, 'MCP server added successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateMcpServerDto })
  @ApiDataResponse(McpServerResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
  ): Promise<ApiResponse<McpServerResponseDto>> {
    const server = await this.mcpServerService.update(id, dto);
    return formatResponse.single(McpServerResponseDto, server, 'MCP server updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove MCP server' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.mcpServerService.softDelete(id);
    return formatResponse.single(null, null, 'MCP server removed successfully.');
  }
}
