import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiParam, ApiQuery, ApiHeader, ApiExtraModels } from '@nestjs/swagger';
import { ApiDataResponse } from '@/common/decorators';
import { formatResponse } from '@/common/helpers';
import type { ApiResponse } from '@/common/interfaces';
import { ProviderConfigService } from '../services/provider-config.service';
import {
  CreateProviderConfigDto,
  UpdateProviderConfigDto,
  ProviderConfigResponseDto,
} from '../dto/provider-config.dto';
import {
  SupportedProviderItemDto,
  ProviderModelDto,
} from '../dto/supported-providers.dto';
import { PROVIDER_REGISTRY, getProviderDefinition } from '../providers/provider-registry';

@ApiTags('Provider Configs')
@ApiExtraModels(
  CreateProviderConfigDto,
  UpdateProviderConfigDto,
  ProviderConfigResponseDto,
  SupportedProviderItemDto,
  ProviderModelDto,
)
@Controller({ path: 'providers', version: '1' })
export class ProviderConfigController {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  @Get('supported')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all supported providers' })
  @ApiDataResponse(SupportedProviderItemDto, { isArray: true })
  async getSupported(): Promise<ApiResponse<SupportedProviderItemDto[]>> {
    const providers = PROVIDER_REGISTRY.map((p) => ({
      ...p,
      hasApiKey: false,
      isAvailable: true,
    }));
    return formatResponse.array(SupportedProviderItemDto, providers, 'Supported providers retrieved successfully.');
  }

  @Get(':provider/models')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get models for a provider' })
  @ApiQuery({ name: 'baseUrl', required: false, type: String })
  @ApiHeader({ name: 'x-api-key', required: false, description: 'Provider API key' })
  @ApiDataResponse(ProviderModelDto, { isArray: true })
  async getProviderModels(
    @Param('provider') provider: string,
    @Query('baseUrl') baseUrl?: string,
    @Headers('x-api-key') apiKey?: string,
  ): Promise<ApiResponse<ProviderModelDto[]>> {
    const definition = getProviderDefinition(provider);
    if (!definition) {
      return formatResponse.array(ProviderModelDto, [], 'Unknown provider.');
    }

    const url = baseUrl || definition.defaultBaseUrl;
    const modelsUrl = definition.nativeModelsUrl
      || `${url}${definition.modelsEndpoint}`;

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        if (provider !== 'google') {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
      }

      const fetchUrl = provider === 'google' && apiKey
        ? `${modelsUrl}?key=${apiKey}`
        : modelsUrl;

      const response = await fetch(fetchUrl, { method: 'GET', headers });
      if (!response.ok) {
        return formatResponse.array(ProviderModelDto, [], `Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      const models = this.parseModels(provider, data);
      return formatResponse.array(ProviderModelDto, models, 'Models retrieved successfully.');
    } catch (error) {
      return formatResponse.array(ProviderModelDto, [], `Failed to fetch models: ${error}`);
    }
  }

  private parseModels(provider: string, data: any): any[] {
    if (provider === 'google') {
      const models = data.models || [];
      return models
        .filter((m: any) => m?.name)
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name,
          contextWindow: m.inputTokenLimit,
          maxOutputTokens: m.outputTokenLimit,
          capabilities: {
            thinking: m.thinking ?? false,
            streaming: true,
          },
        }));
    }

    // OpenAI-compatible format
    const models = data.data || data.models || [];
    return models.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextWindow: m.context_window || m.context_length,
      maxOutputTokens: m.max_output_tokens || m.max_tokens,
    }));
  }

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
