import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ProviderCapabilitiesDto {
  @ApiPropertyOptional() vision?: boolean;
  @ApiPropertyOptional() toolCalling?: boolean;
  @ApiPropertyOptional() streaming?: boolean;
  @ApiPropertyOptional() thinking?: boolean;
  @ApiPropertyOptional() structuredOutput?: boolean;
}

export class SupportedProviderItemDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  description: string;

  @Expose()
  @ApiProperty()
  defaultBaseUrl: string;

  @Expose()
  @ApiProperty()
  format: string;

  @Expose()
  @ApiProperty()
  requiresApiKey: boolean;

  @Expose()
  @ApiProperty()
  requiresBaseUrl: boolean;

  @Expose()
  @ApiProperty()
  adapterType: string;

  @Expose()
  @ApiProperty()
  modelsEndpoint: string;

  @Expose()
  @ApiProperty()
  hasApiKey: boolean;

  @Expose()
  @ApiProperty()
  isAvailable: boolean;
}

export class ProviderModelDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiPropertyOptional()
  contextWindow?: number;

  @Expose()
  @ApiPropertyOptional()
  maxOutputTokens?: number;

  @Expose()
  @ApiPropertyOptional({ type: ProviderCapabilitiesDto })
  capabilities?: ProviderCapabilitiesDto;

  @Expose()
  @ApiPropertyOptional()
  deprecated?: boolean;

  @Expose()
  @ApiPropertyOptional()
  deprecationDate?: string;
}

export class ProviderModelsGroupDto {
  @Expose()
  @ApiProperty()
  provider: string;

  @Expose()
  @ApiProperty()
  providerName: string;

  @Expose()
  @ApiProperty()
  configured: boolean;

  @Expose()
  @ApiProperty({ type: [ProviderModelDto] })
  @Type(() => ProviderModelDto)
  models: ProviderModelDto[];

  @Expose()
  @ApiPropertyOptional()
  error?: string;
}
