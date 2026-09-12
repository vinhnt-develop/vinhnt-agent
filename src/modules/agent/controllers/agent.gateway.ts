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
import { AgentRunTrackingService } from '../services/agent-run-tracking.service';

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

  constructor(
    private readonly agentService: AgentService,
    private readonly trackingService: AgentRunTrackingService,
  ) {}

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
      const { handle, runId } = await this.agentService.runAgentStreaming(data);
      const runStartedAt = Date.now();

      client.emit('run:started', { runId });

      // Stream events to client + track tool executions
      for await (const event of handle.events()) {
        client.emit('run:event', event);

        if (event.type === 'tool.invoked') {
          this.trackingService.startToolExecution({
            runId,
            sessionId: data.sessionId,
            toolName: event.data?.toolName || 'unknown',
            toolInput: event.data?.input,
          });
        } else if (event.type === 'tool.completed') {
          this.trackingService.completeToolExecution({
            runId,
            toolName: event.data?.toolName || 'unknown',
            toolOutput: event.data?.output,
            status: 'completed',
          });
        } else if (event.type === 'tool.failed') {
          this.trackingService.completeToolExecution({
            runId,
            toolName: event.data?.toolName || 'unknown',
            status: 'failed',
            errorMessage: event.data?.error,
          });
        }
      }

      const result = await handle.completed;
      const durationMs = Date.now() - runStartedAt;

      this.trackingService.completeRun({
        runId,
        status: 'succeeded',
        inputTokens: result?.usage?.promptTokens,
        outputTokens: result?.usage?.completionTokens,
        totalCost: result?.cost,
        durationMs,
        toolCallsCount: result?.toolCalls?.length,
      });

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
