import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ProviderCapabilitiesDto {
  @ApiPropertyOptional({ description: 'Supports vision/image input', example: false })
  @Expose({ name: 'vision' })
  vision?: boolean;

  @ApiPropertyOptional({ description: 'Supports tool/function calling', example: true })
  @Expose({ name: 'tool_calling' })
  toolCalling?: boolean;

  @ApiPropertyOptional({ description: 'Supports streaming responses', example: true })
  @Expose({ name: 'streaming' })
  streaming?: boolean;

  @ApiPropertyOptional({ description: 'Supports thinking/reasoning tokens', example: false })
  @Expose({ name: 'thinking' })
  thinking?: boolean;

  @ApiPropertyOptional({ description: 'Supports structured output', example: false })
  @Expose({ name: 'structured_output' })
  structuredOutput?: boolean;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class SupportedProviderItemDto {
  @ApiProperty({ description: 'Provider identifier', example: 'openai' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Provider display name', example: 'OpenAI' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiProperty({ description: 'Provider description', example: 'GPT-4o, GPT-4.1, o3, o4-mini' })
  @Expose({ name: 'description' })
  description!: string;

  @ApiProperty({ description: 'Default base URL for API', example: 'https://api.openai.com/v1' })
  @Expose({ name: 'default_base_url' })
  defaultBaseUrl!: string;

  @ApiProperty({ description: 'API format type', example: 'openai-chat' })
  @Expose({ name: 'format' })
  format!: string;

  @ApiProperty({ description: 'Whether API key is required', example: true })
  @Expose({ name: 'requires_api_key' })
  requiresApiKey!: boolean;

  @ApiProperty({ description: 'Whether base URL is required', example: false })
  @Expose({ name: 'requires_base_url' })
  requiresBaseUrl!: boolean;

  @ApiProperty({ description: 'Adapter type', example: 'openai' })
  @Expose({ name: 'adapter_type' })
  adapterType!: string;

  @ApiProperty({ description: 'Models endpoint path', example: '/models' })
  @Expose({ name: 'models_endpoint' })
  modelsEndpoint!: string;

  @ApiProperty({ description: 'Whether API key is configured', example: false })
  @Expose({ name: 'has_api_key' })
  hasApiKey!: boolean;

  @ApiProperty({ description: 'Whether provider is available', example: true })
  @Expose({ name: 'is_available' })
  isAvailable!: boolean;

  @ApiPropertyOptional({ description: 'Provider capabilities', type: ProviderCapabilitiesDto })
  @Expose({ name: 'capabilities' })
  @Type(() => ProviderCapabilitiesDto)
  capabilities?: ProviderCapabilitiesDto;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class ProviderModelDto {
  @ApiProperty({ description: 'Model identifier', example: 'gpt-4o' })
  @Expose({ name: 'id' })
  id!: string;

  @ApiProperty({ description: 'Model display name', example: 'GPT-4o' })
  @Expose({ name: 'name' })
  name!: string;

  @ApiPropertyOptional({ description: 'Context window size', example: 128000 })
  @Expose({ name: 'context_window' })
  contextWindow?: number;

  @ApiPropertyOptional({ description: 'Maximum output tokens', example: 4096 })
  @Expose({ name: 'max_output_tokens' })
  maxOutputTokens?: number;

  @ApiPropertyOptional({ description: 'Model capabilities', type: ProviderCapabilitiesDto })
  @Expose({ name: 'capabilities' })
  @Type(() => ProviderCapabilitiesDto)
  capabilities?: ProviderCapabilitiesDto;

  @ApiPropertyOptional({ description: 'Whether model is deprecated', example: false })
  @Expose({ name: 'deprecated' })
  deprecated?: boolean;

  @ApiPropertyOptional({ description: 'Deprecation date (ISO 8601)', example: '2026-12-31' })
  @Expose({ name: 'deprecation_date' })
  deprecationDate?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}

export class ProviderModelsGroupDto {
  @ApiProperty({ description: 'Provider identifier', example: 'openai' })
  @Expose({ name: 'provider' })
  provider!: string;

  @ApiProperty({ description: 'Provider display name', example: 'OpenAI' })
  @Expose({ name: 'provider_name' })
  providerName!: string;

  @ApiProperty({ description: 'Whether provider is configured', example: true })
  @Expose({ name: 'configured' })
  configured!: boolean;

  @ApiProperty({ description: 'Whether provider is active', example: true })
  @Expose({ name: 'is_active' })
  isActive!: boolean;

  @ApiProperty({ description: 'List of models', type: [ProviderModelDto] })
  @Expose({ name: 'models' })
  @Type(() => ProviderModelDto)
  models!: ProviderModelDto[];

  @ApiPropertyOptional({ description: 'Error message if fetch failed', example: 'Failed to fetch models: 401' })
  @Expose({ name: 'error' })
  error?: string;

  @ApiPropertyOptional({ description: 'Extensible metadata', type: 'object', additionalProperties: true })
  @Expose({ name: 'metadata' })
  metadata?: Record<string, unknown>;
}