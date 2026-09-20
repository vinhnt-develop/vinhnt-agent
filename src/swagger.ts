import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataMetaData, DataResponse } from './common/decorators';

const config = new DocumentBuilder()
  .setTitle('vinhnt-agent API')
  .setDescription('Local AI agent powered by vinhnt-sdk - Full REST API documentation')
  .setVersion('1.0')
  .addTag('Health', 'Health check and readiness/liveness endpoints')
  .addTag('Workspace', 'Workspace management (CRUD, activation)')
  .addTag('Session', 'Session and message management')
  .addTag('Agent', 'Agent execution (run, streaming, stats, trajectory)')
  .addTag('Agent Settings', 'Agent kernel settings configuration')
  .addTag('Provider Config', 'Provider configuration management')
  .addTag('File Explorer', 'File system operations (tree, content)')
  .addTag('Git Explorer', 'Git operations (status, diff, log)')
  .addTag('Knowledge', 'Knowledge base management')
  .addTag('Tool Config', 'Tool configuration management')
  .addTag('Plugin Config', 'Plugin configuration management')
  .addTag('Sync', 'Cloud sync operations')
  .addBearerAuth(
    { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    'JWT-auth',
  )
  .addApiKey(
    { type: 'apiKey', name: 'x-api-key', in: 'header' },
    'Provider-API-Key',
  )
  .build();

export const createSwaggerDocument = (app: NestExpressApplication) => {
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [DataResponse, DataMetaData],
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('api-doc', app, document, {
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      persistAuthorization: true,
      displayOperationId: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'vinhnt-agent API Docs',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { color: #3b82f6; }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 1rem; border-radius: 0.5rem; }
    `,
  });
};
