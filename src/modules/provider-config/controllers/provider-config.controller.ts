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
import { ProviderConfigService } from '../services/provider-config.service';
import { CreateProviderConfigDto, UpdateProviderConfigDto, ProviderConfigResponseDto } from '../dto';

@ApiTags('Provider Configs')
@ApiExtraModels(CreateProviderConfigDto, UpdateProviderConfigDto, ProviderConfigResponseDto)
@Controller({ path: 'providers', version: '1' })
export class ProviderConfigController {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List provider configs' })
  @ApiDataResponse(ProviderConfigResponseDto, { isArray: true })
  async findAll(): Promise<ApiResponse<ProviderConfigResponseDto[]>> {
    const configs = await this.providerConfigService.findAll();
    return formatResponse.array(ProviderConfigResponseDto, configs, 'Provider configs retrieved successfully.');
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get provider config by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(ProviderConfigResponseDto)
  async findById(@Param('id') id: string): Promise<ApiResponse<ProviderConfigResponseDto>> {
    const config = await this.providerConfigService.findById(id);
    return formatResponse.single(ProviderConfigResponseDto, config, 'Provider config retrieved successfully.');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create provider config' })
  @ApiBody({ type: CreateProviderConfigDto })
  @ApiDataResponse(ProviderConfigResponseDto)
  async create(@Body() dto: CreateProviderConfigDto): Promise<ApiResponse<ProviderConfigResponseDto>> {
    const config = await this.providerConfigService.create(dto);
    return formatResponse.single(ProviderConfigResponseDto, config, 'Provider config created successfully.');
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update provider config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiBody({ type: UpdateProviderConfigDto })
  @ApiDataResponse(ProviderConfigResponseDto)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProviderConfigDto,
  ): Promise<ApiResponse<ProviderConfigResponseDto>> {
    const config = await this.providerConfigService.update(id, dto);
    return formatResponse.single(ProviderConfigResponseDto, config, 'Provider config updated successfully.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete provider config' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiDataResponse(null)
  async remove(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.providerConfigService.softDelete(id);
    return formatResponse.single(null, null, 'Provider config deleted successfully.');
  }
}
