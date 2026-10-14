import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  SpanRecorder,
  addSpanEvent,
  createOtlpSpanExporter,
  type Span,
  type SpanExporter,
} from '@vinhnt-sdk/trace';
import { AgentService } from './agent.service';
import { AgentSettingsService } from './agent-settings.service';

/** Structural view of a bus event — TypedEvent<unknown> is assignable. */
type BusEvent = {
  readonly type?: string;
  readonly aggregateId?: string;
  readonly traceId?: string;
  readonly data?: unknown;
};

interface ActiveRun {
  recorder: SpanRecorder;
  span: Span;
  exporter: SpanExporter;
  events: number;
}

/** Cap on concurrently tracked runs — oldest entry evicted past this. */
const MAX_ACTIVE_RUNS = 256;
/** Cap on span events per run so a tool-heavy run can't blow up the payload. */
const MAX_SPAN_EVENTS = 500;
/** Truncate error/reason strings before they land in telemetry. */
const MAX_TEXT_LEN = 300;

const STRING_ATTRS = ['model', 'provider', 'agentName', 'resource', 'permission', 'reply', 'risk', 'decision', 'source', 'toolName', 'toolId', 'stopReason', 'fromProvider', 'fromModel', 'toProvider', 'toModel'] as const;
const NUMBER_ATTRS = ['turn', 'step', 'toolCallCount', 'durationMs', 'attempt', 'delayMs', 'originalCount', 'compressedCount', 'totalSteps', 'inputTokens', 'outputTokens'] as const;

/**
 * P6.4 — OTLP opt-in: when `settings.otlpEndpoint` is set, every run is
 * spanned (`agent.run` root + whitelisted step/tool/permission/failover
 * events) and POSTed to the OTLP/HTTP traces endpoint on `run.completed`.
 *
 * Opt-in contract: with an empty endpoint the `run.started` branch returns
 * before creating anything — default path stays exactly as before.
 *
 * Privacy: span attributes/events only ever carry the whitelisted scalar
 * fields below — tool input/output and prompt content never reach telemetry.
 */
@Injectable()
export class AgentOtlpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentOtlpService.name);
  private unsubscribe?: () => void;
  /** endpoint → memoized exporter (created once per distinct endpoint). */
  private readonly exporters = new Map<string, SpanExporter>();
  private readonly runs = new Map<string, ActiveRun>();

  constructor(
    private readonly agentService: AgentService,
    private readonly settingsService: AgentSettingsService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.agentService.getEventBus().subscribeAll((event) => {
      try {
        this.handleEvent(event);
      } catch (err) {
        this.logger.warn(
          `OTLP span handling failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.runs.clear();
    for (const exporter of this.exporters.values()) {
      void exporter.shutdown();
    }
    this.exporters.clear();
  }

  /** Bus handler body — public for tests (the subscription wraps it). */
  handleEvent(event: BusEvent): void {
    const runId = event.aggregateId;
    const type = event.type;
    if (!runId || !type) return;

    if (type === 'run.started') {
      this.startRun(runId, event);
      return;
    }

    const active = this.runs.get(runId);
    if (!active) return;

    if (type === 'run.completed') {
      this.completeRun(runId, active, event);
      return;
    }

    if (active.events >= MAX_SPAN_EVENTS) return;
    const attrs = spanEventAttributes(type, event.data);
    if (attrs) {
      active.events += 1;
      addSpanEvent(active.span, type, attrs);
    }
  }

  private startRun(runId: string, event: BusEvent): void {
    const endpoint = this.settingsService.getSettings().otlpEndpoint?.trim();
    if (!endpoint) return; // opt-in only — no endpoint, no trace state (P6.4)

    const exporter = this.getExporter(endpoint);
    if (!exporter) return;

    if (this.runs.size >= MAX_ACTIVE_RUNS) {
      const oldest = this.runs.keys().next();
      if (!oldest.done) this.runs.delete(oldest.value);
    }

    const recorder = new SpanRecorder(
      typeof event.traceId === 'string' && event.traceId ? event.traceId : undefined,
    );
    const span = recorder.startSpan('agent.run', 'internal');
    span.attributes.runId = runId;
    const data = (event.data ?? {}) as Record<string, unknown>;
    for (const key of ['model', 'provider', 'agentName'] as const) {
      const value = data[key];
      if (typeof value === 'string' && value) span.attributes[key] = value;
    }
    this.runs.set(runId, { recorder, span, exporter, events: 0 });
  }

  private completeRun(runId: string, active: ActiveRun, event: BusEvent): void {
    this.runs.delete(runId);
    const data = (event.data ?? {}) as Record<string, unknown>;
    if (typeof data.status === 'string') active.span.attributes.status = data.status;
    for (const key of ['stopReason', 'totalSteps', 'inputTokens', 'outputTokens'] as const) {
      const value = data[key];
      if (typeof value === 'string' || typeof value === 'number') {
        active.span.attributes[key] = value;
      }
    }
    active.recorder.endSpan(active.span, data.status === 'failed' ? 'error' : 'ok');
    void active.exporter.export(active.recorder.getSpans()).catch((err: unknown) => {
      this.logger.warn(
        `OTLP export failed for run ${runId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  private getExporter(endpoint: string): SpanExporter | undefined {
    const existing = this.exporters.get(endpoint);
    if (existing) return existing;
    try {
      const exporter = createOtlpSpanExporter({ endpoint });
      this.exporters.set(endpoint, exporter);
      return exporter;
    } catch (err) {
      this.logger.warn(
        `OTLP exporter init failed (${endpoint}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }
}

function clip(value: string): string {
  return value.length > MAX_TEXT_LEN ? `${value.slice(0, MAX_TEXT_LEN)}…` : value;
}

/**
 * Whitelist projection of event data → span-event attributes. Returns null
 * for event types that carry no useful (safe) signal — token/text chatter
 * never becomes a span event.
 */
function spanEventAttributes(type: string, raw: unknown): Record<string, unknown> | null {
  const data = (raw ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  switch (type) {
    case 'step.started':
    case 'step.completed':
    case 'step.failed':
    case 'tool.invoked':
    case 'tool.completed':
    case 'tool.failed':
    case 'permission.requested':
    case 'permission.replied':
    case 'llm.retry':
    case 'llm.failover':
    case 'context.compressed':
      break;
    default:
      return null;
  }

  for (const key of STRING_ATTRS) {
    const value = data[key];
    if (typeof value === 'string' && value) out[key] = clip(value);
  }
  for (const key of NUMBER_ATTRS) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  if (type === 'step.failed' || type === 'tool.failed' || type === 'llm.failover' || type === 'llm.retry') {
    const reason = data.reason ?? data.error;
    if (typeof reason === 'string' && reason) out.reason = clip(reason);
  }
  if (type === 'context.compressed' && typeof data.summary === 'string' && data.summary) {
    out.summary = clip(data.summary);
  }

  return Object.keys(out).length > 0 ? out : null;
}
