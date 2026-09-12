import { FileExplorerModule } from './file-explorer';
import { GitExplorerModule } from './git-explorer';
import { AgentModule } from './agent';
import { HealthModule } from './health';
import { WorkspaceModule } from './workspace';
import { ProjectModule } from './project';
import { SessionModule } from './session';
import { KnowledgeModule } from './knowledge';
import { McpServersModule } from './mcp-servers';
import { ProviderConfigModule } from './provider-config';
import { CredentialModule } from './credential';
import { CustomToolsModule } from './custom-tools';

export const modules = [
  AgentModule,
  HealthModule,
  FileExplorerModule,
  GitExplorerModule,
  WorkspaceModule,
  ProjectModule,
  SessionModule,
  KnowledgeModule,
  McpServersModule,
  ProviderConfigModule,
  CredentialModule,
  CustomToolsModule,
];
