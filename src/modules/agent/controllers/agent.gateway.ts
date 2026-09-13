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

/**
 * Extract human-readable error message from any error type.
 * Preserves the original message without wrapping.
 */
function extractActualErrorMessage(error: unknown): string {
  if (!error) return 'Unknown error';
  
  // If it's already an Error instance, use message directly
  if (error instanceof Error) {
    return error.message;
  }
  
  // If it's a string, try to parse as JSON to extract nested message
  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error);
      return extractActualErrorMessage(parsed);
    } catch {
      return error;
    }
  }
  
  // If it's an object, try to extract message from nested structures
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    
    // Google API format: { error: { error: { message: "..." } } }
    if (obj.error && typeof obj.error === 'object') {
      const innerError = obj.error as Record<string, unknown>;
      if (innerError.error && typeof innerError.error === 'object') {
        const deepError = innerError.error as Record<string, unknown>;
        if (typeof deepError.message === 'string') return deepError.message;
      }
      // OpenAI format: { error: { message: "..." } }
      if (typeof innerError.message === 'string') return innerError.message;
      // Plain error string: { error: "..." }
      if (typeof innerError.error === 'string') return innerError.error;
    }
    
    // Direct message: { message: "..." }
    if (typeof obj.message === 'string') return obj.message;
    
    // VntError/KernelError serialized: { name: "...", message: "...", code: "..." }
    if (typeof obj.message === 'string') return obj.message;
  }
  
  // Fallback: stringify and return
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

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

      // Capture error from events stream (emitFail puts error in run.completed event)
      let capturedError: string | null = null;

      // Stream events to client + track tool executions
      for await (const event of handle.events()) {
        client.emit('run:event', event);

        // Capture error from run.completed event with status=failed
        if (event.type === 'run.completed' && event.data?.status === 'failed') {
          capturedError = event.data?.error || null;
        }

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

      // Check if the run failed
      const hasError = !result || (result as any).error || (result as any).status === 'failed' || capturedError;
      
      if (hasError) {
        // Use captured error from events stream, fallback to result fields
        const rawError = capturedError || (result as any)?.error || (result as any)?.output || 'Agent run failed';
        const errorMsg = extractActualErrorMessage(rawError);
        
        this.logger.error(`Run failed for session ${data.sessionId}:`, errorMsg);
        
        this.trackingService.completeRun({
          runId,
          status: 'failed',
          durationMs,
          errorMessage: errorMsg,
        });

        client.emit('run:error', {
          error: errorMsg,
        });
      } else {
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
      }
    } catch (error) {
      const errorMsg = extractActualErrorMessage(error);
      this.logger.error(`Run failed for ${client.id}`, errorMsg);
      client.emit('run:error', {
        error: errorMsg,
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
