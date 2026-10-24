import type { ToolContext, ToolDefinition } from '@vinhnt-sdk/tools';

/** Default elicitation deadline: 5 minutes. */
export const DEFAULT_ELICIT_TIMEOUT_MS = 300_000;

/** Resolve the configured elicitation deadline (ms). */
export function resolveElicitTimeoutMs(
  value: string | undefined = process.env.AGENT_ELICIT_TIMEOUT_MS,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1000
    ? parsed
    : DEFAULT_ELICIT_TIMEOUT_MS;
}

/**
 * Attach an explicit deadline to every elicitation started by the tool.
 *
 * The SDK emits `elicitation.requested` before awaiting the store, so the
 * deadline has to be injected into `ctx.askElicitation` rather than added later
 * by the store. This keeps the live event, the REST rehydration payload and the
 * awaited timeout in agreement without requiring a new SDK release.
 */
export function withElicitationDeadline(
  tool: ToolDefinition,
  timeoutMs: number | (() => number) = DEFAULT_ELICIT_TIMEOUT_MS,
): ToolDefinition {
  return {
    ...tool,
    execute: async (raw: unknown, ctx: ToolContext) => {
      const ask = ctx.askElicitation;
      if (!ask) return tool.execute(raw, ctx);
      const resolved = typeof timeoutMs === 'function' ? timeoutMs() : timeoutMs;
      const expiresAt = Date.now() + resolved;
      return tool.execute(raw, {
        ...ctx,
        askElicitation: (input) =>
          ask({
            ...input,
            expiresAt,
            timeoutMs: resolved,
          }),
      });
    },
  };
}
