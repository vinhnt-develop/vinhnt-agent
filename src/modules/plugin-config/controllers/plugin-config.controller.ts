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
import { PluginConfigService } from '../services/plugin-config.service';
import { CreatePluginConfigDto, UpdatePluginConfigDto, PluginConfigResponseDto } from '../dto';

@ApiTags('Plugin Config')
@ApiExtraModels(CreatePluginConfigDto, UpdatePluginConfigDto, PluginConfigResponseDto)
@Controller({ path: 'plugins', version: '1' })
export class PluginConfigController {
  constructor(private readonly pluginConfigService: PluginConfigService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List plugin configs' })
  @ApiDataResponse(PluginConfigResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<PluginConfigResponseDto[]>> {
    const configs = await this.pluginConfigService.findAll();
    return formatResponse.array(PluginConfigResponseDto, configs, 'Plugin configs retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get plugin config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(PluginConfigResponseDto)
  async findOne(@Param('id') id: string): Promise<ApiResponse<PluginConfigResponseDto>> {
    const config = await this.pluginConfigService.findById(id);
    return formatResponse.single(PluginConfigResponseDto, config, 'Plugin config retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Install plugin' })
  @ApiBody({ type: CreatePluginConfigDto })
  @ApiDataResponse(PluginConfigResponseDto)
  async create(@Body() dto: CreatePluginConfigDto): Promise<ApiResponse<PluginConfigResponseDto>> {
    const config = await this.pluginConfigService.create(dto);
    return formatResponse.single(PluginConfigResponseDto, config, 'Plugin installed successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update plugin config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdatePluginConfigDto })
  @ApiDataResponse(PluginConfigResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePluginConfigDto,
  ): Promise<ApiResponse<PluginConfigResponseDto>> {
    const config = await this.pluginConfigService.update(id, dto);
    return formatResponse.single(PluginConfigResponseDto, config, 'Plugin config updated successfully.');
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate plugin' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(PluginConfigResponseDto)
  async activate(@Param('id') id: string): Promise<ApiResponse<PluginConfigResponseDto>> {
    const config = await this.pluginConfigService.activate(id);
    return formatResponse.single(PluginConfigResponseDto, config, 'Plugin activated successfully.');
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate plugin' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(PluginConfigResponseDto)
  async deactivate(@Param('id') id: string): Promise<ApiResponse<PluginConfigResponseDto>> {
    const config = await this.pluginConfigService.deactivate(id);
    return formatResponse.single(PluginConfigResponseDto, config, 'Plugin deactivated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uninstall plugin' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.pluginConfigService.softDelete(id);
    return formatResponse.single(null, null, 'Plugin uninstalled successfully.');
  }
}
