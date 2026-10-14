/**
 * P6.5 — canonical PermissionMode vocabulary lives in `@vinhnt-sdk/permission`.
 *
 * Re-export barrel (zero churn for consumers importing `@/shared/permission-mode`).
 * Since SDK 0.11.0 the published package exports the open union `PermissionMode`
 * (`KnownPermissionMode | (string & {})`) and the 8-mode `KNOWN_PERMISSION_MODES`
 * (`default | acceptEdits | plan | bypass | auto | ask | edit | full`) — including
 * the Phase 6/7 modes (acceptEdits/plan/bypass/auto + auto risk classifier).
 */

export type { PermissionMode } from '@vinhnt-sdk/permission';
export { KNOWN_PERMISSION_MODES } from '@vinhnt-sdk/permission';
