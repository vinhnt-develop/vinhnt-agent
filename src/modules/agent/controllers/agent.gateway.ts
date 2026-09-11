import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AgentService } from '../services';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/agent',
})
export class AgentGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentGateway.name);
  private unsubscribe?: () => void;

  constructor(private readonly agentService: AgentService) {}

  onModuleInit() {
    const eventBus = this.agentService.getEventBus();
    this.unsubscribe = eventBus.subscribeAll((event) => {
      this.server?.emit('agent:event', event);
    });
    this.logger.log('AgentGateway subscribed to EventBus');
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('run')
  async handleRun(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      prompt: string;
      model?: string;
      provider?: string;
      workspaceId?: string;
    },
  ) {
    this.logger.log(
      `Run requested by ${client.id} for session ${data.sessionId}`,
    );

    try {
      const handle = await this.agentService.runAgentStreaming(data);

      client.emit('run:started', { runId: handle.runId });

      // Stream events to client
      for await (const event of handle.events()) {
        client.emit('run:event', event);
      }

      const result = await handle.completed;
      client.emit('run:completed', result);
    } catch (error) {
      this.logger.error(`Run failed for ${client.id}`, error);
      client.emit('run:error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @SubscribeMessage('cancel')
  async handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runId: string },
  ) {
    this.logger.log(`Cancel requested by ${client.id} for run ${data.runId}`);
    await this.agentService.cancelRun(data.runId);
    client.emit('run:cancelled', { runId: data.runId });
  }

  @SubscribeMessage('messages')
  async handleMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const messages = await this.agentService.getSessionMessages(data.sessionId);
    client.emit('messages', messages);
  }
}
