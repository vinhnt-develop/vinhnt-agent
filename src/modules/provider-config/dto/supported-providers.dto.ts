import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ProviderCapabilitiesDto {
  @ApiPropertyOptional({ name: 'vision', type: Boolean, description: 'Supports vision/image input', example: false })
  @Expose({ name: 'vision' })
  vision?: boolean;

  @ApiPropertyOptional({ name: 'toolCalling', type: Boolean, description: 'Supports tool/function calling', example: true })
  @Expose({ name: 'toolCalling' })
  toolCalling?: boolean;

  @ApiPropertyOptional({ name: 'streaming', type: Boolean, description: 'Supports streaming responses', example: true })
  @Expose({ name: 'streaming' })
  streaming?: boolean;

  @ApiPropertyOptional({ name: 'thinking', type: Boolean, description: 'Supports thinking/reasoning tokens', example: false })
  @Expose({ name: 'thinking' })
  thinking?: boolean;

  @ApiPropertyOptional({ name: 'structuredOutput', type: Boolean, description: 'Supports structured output', example: false })
  @Expose({ name: 'structuredOutput' })
  structuredOutput?: boolean;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class SupportedProviderItemDto {
  @ApiProperty({ name: 'id', type: String, description: 'Provider identifier', example: 'openai' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Provider display name', example: 'OpenAI' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ name: 'description', type: String, description: 'Provider description', example: 'GPT-4o, GPT-4.1, o3, o4-mini' })
  @Expose({ name: 'description' })
  description!: string;

  @ApiProperty({ name: 'defaultBaseUrl', type: String, description: 'Default base URL for API', example: 'https://api.openai.com/v1' })
  @Expose({ name: 'defaultBaseUrl' })
  defaultBaseUrl!: string;

  @ApiProperty({ name: 'format', type: String, description: 'API format type', example: 'openai-chat' })
  @Expose({ name: 'format' })
  format!: string;

  @ApiProperty({ name: 'requiresApiKey', type: Boolean, description: 'Whether API key is required', example: true })
  @Expose({ name: 'requiresApiKey' })
  requiresApiKey!: boolean;

  @ApiProperty({ name: 'requiresBaseUrl', type: Boolean, description: 'Whether base URL is required', example: false })
  @Expose({ name: 'requiresBaseUrl' })
  requiresBaseUrl!: boolean;

  @ApiProperty({ name: 'adapterType', type: String, description: 'Adapter type', example: 'openai' })
  @Expose({ name: 'adapterType' })
  adapterType!: string;

  @ApiProperty({ name: 'modelsEndpoint', type: String, description: 'Models endpoint path', example: '/models' })
  @Expose({ name: 'modelsEndpoint' })
  modelsEndpoint!: string;

  @ApiProperty({ name: 'hasApiKey', type: Boolean, description: 'Whether API key is configured', example: false })
  @Expose({ name: 'hasApiKey' })
  hasApiKey!: boolean;

  @ApiProperty({ name: 'isAvailable', type: Boolean, description: 'Whether provider is available', example: true })
  @Expose({ name: 'isAvailable' })
  isAvailable!: boolean;

  @ApiPropertyOptional({ name: 'capabilities', type: ProviderCapabilitiesDto, description: 'Provider capabilities' })
  @Expose({ name: 'capabilities' })
  @Type(() => ProviderCapabilitiesDto)
  capabilities?: ProviderCapabilitiesDto;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class ProviderModelDto {
  @ApiProperty({ name: 'id', type: String, description: 'Model identifier', example: 'gpt-4o' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ name: 'name', type: String, description: 'Model display name', example: 'GPT-4o' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ name: 'contextWindow', type: Number, description: 'Context window size', example: 128000 })
  @Expose({ name: 'contextWindow' })
  contextWindow?: number;

  @ApiPropertyOptional({ name: 'maxOutputTokens', type: Number, description: 'Maximum output tokens', example: 4096 })
  @Expose({ name: 'maxOutputTokens' })
  maxOutputTokens?: number;

  @ApiPropertyOptional({ name: 'capabilities', type: ProviderCapabilitiesDto, description: 'Model capabilities' })
  @Expose({ name: 'capabilities' })
  @Type(() => ProviderCapabilitiesDto)
  capabilities?: ProviderCapabilitiesDto;

  @ApiPropertyOptional({ name: 'deprecated', type: Boolean, description: 'Whether model is deprecated', example: false })
  @Expose({ name: 'deprecated' })
  deprecated?: boolean;

  @ApiPropertyOptional({ name: 'deprecationDate', type: String, description: 'Deprecation date (ISO 8601)', example: '2026-12-31' })
  @Expose({ name: 'deprecationDate' })
  deprecationDate?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class ProviderModelsGroupDto {
  @ApiProperty({ name: 'provider', type: String, description: 'Provider identifier', example: 'openai' })
  @Expose({ name: 'provider' })
  provider!: string;

  @ApiProperty({ name: 'providerName', type: String, description: 'Provider display name', example: 'OpenAI' })
  @Expose({ name: 'providerName' })
  providerName!: string;

  @ApiProperty({ name: 'configured', type: Boolean, description: 'Whether provider is configured', example: true })
  @Expose({ name: 'configured' })
  configured!: boolean;

  @ApiProperty({ name: 'isActive', type: Boolean, description: 'Whether provider is active', example: true })
  @Expose({ name: 'isActive' })
  isActive!: boolean;

  @ApiProperty({ name: 'models', type: [ProviderModelDto], description: 'List of models' })
  @Expose({ name: 'models' })
  @Type(() => ProviderModelDto)
  models!: ProviderModelDto[];

  @ApiPropertyOptional({ name: 'error', type: String, description: 'Error message if fetch failed', example: 'Failed to fetch models: 401' })
  @Expose({ name: 'error' })
  error?: string;

  @ApiPropertyOptional({ name: 'metadata', type: 'object', description: 'Extensible metadata', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}
