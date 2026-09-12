import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JsonConfigStore,
  type ProviderJsonConfig,
  type McpServerJsonConfig,
  type CustomToolJsonConfig,
  type CredentialJsonConfig,
} from './json-config-store';
import * as path from 'node:path';

export const PROVIDERS_CONFIG = 'PROVIDERS_CONFIG';
export const MCP_SERVERS_CONFIG = 'MCP_SERVERS_CONFIG';
export const CUSTOM_TOOLS_CONFIG = 'CUSTOM_TOOLS_CONFIG';
export const CREDENTIALS_CONFIG = 'CREDENTIALS_CONFIG';

@Global()
@Module({
  providers: [
    {
      provide: PROVIDERS_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const configDir = configService.get<string>('CONFIG_DIR')
          || path.join(process.cwd(), 'config');
        return new JsonConfigStore<ProviderJsonConfig>(configDir, 'providers.json');
      },
    },
    {
      provide: MCP_SERVERS_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const configDir = configService.get<string>('CONFIG_DIR')
          || path.join(process.cwd(), 'config');
        return new JsonConfigStore<McpServerJsonConfig>(configDir, 'mcp-servers.json');
      },
    },
    {
      provide: CUSTOM_TOOLS_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const configDir = configService.get<string>('CONFIG_DIR')
          || path.join(process.cwd(), 'config');
        return new JsonConfigStore<CustomToolJsonConfig>(configDir, 'custom-tools.json');
      },
    },
    {
      provide: CREDENTIALS_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const configDir = configService.get<string>('CONFIG_DIR')
          || path.join(process.cwd(), 'config');
        return new JsonConfigStore<CredentialJsonConfig>(configDir, 'credentials.json');
      },
    },
  ],
  exports: [PROVIDERS_CONFIG, MCP_SERVERS_CONFIG, CUSTOM_TOOLS_CONFIG, CREDENTIALS_CONFIG],
})
export class AppConfigModule {}
