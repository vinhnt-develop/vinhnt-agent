import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataMetaData, DataResponse } from './common/decorators';

const config = new DocumentBuilder()
  .setTitle('vinhnt-agent API')
  .setDescription('Local AI agent powered by vinhnt-sdk')
  .setVersion('1.0')
  .addTag('Health', 'Health check endpoints')
  .addTag('Workspace', 'Workspace management')
  .addTag('Project', 'Project management')
  .addTag('Session', 'Session and message management')
  .addTag('Knowledge', 'Knowledge base management')
  .addTag('Tool Config', 'Tool configuration management')
  .addTag('Plugin Config', 'Plugin configuration management')
  .addTag('Agent', 'Agent execution')
  .addTag('File Explorer', 'File system operations')
  .addTag('Git Explorer', 'Git operations')
  .addTag('Sync', 'Cloud sync')
  .build();

export const createSwaggerDocument = (app: NestExpressApplication) => {
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [DataResponse, DataMetaData],
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api-doc', app, document, {
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'vinhnt-agent API Docs',
  });
};
