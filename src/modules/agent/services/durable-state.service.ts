import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  StateGraphExecutor,
  createMemoryCheckpointer,
  runStateToSnapshot,
  snapshotToRunState,
  snapshotFromDefinition,
  applyDeltaToSnapshot,
  SessionStoreCheckpointer,
  type StateGraphDefinition,
  type GraphConfig,
  type StateSnapshot,
  type StepResult,
  type Command,
} from '@vinhnt-sdk/durable-state';
import { SqliteRunEventStore } from '@/infrastructure/storage/sqlite-run-event-store';
import { SqliteSessionStore } from '@/infrastructure/storage/sqlite-session-store';
import type { SerializedRunState } from '@vinhnt-sdk/session';
import type { RunEventSnapshot } from '@vinhnt-sdk/schema';

/**
 * Wrapper autour của @vinhnt-sdk/durable-state cho vinhnt-agent.
 *
 * Cung cấp:
 *  - SessionStoreCheckpointer: lưu StateSnapshot vào SQLite qua SqliteRunEventStore
 *    (dùng runId làm threadId — 1:1 với session/run).
 *  - StateGraphExecutor factory: chạy graph durable với checkpoint per node.
 *  - Adapter: SerializedRunState <-> StateSnapshot để tích hợp với run loop hiện có.
 *
 * Gói này là **additive** — không thay đổi SerializedRunState, runEventStore, hoặc
 * sessionStore hiện tại. Chỉ cung cấp khả năng durable graph state (checkpoint,
 * time-travel, interrupt/resume) song song với hệ thống HITL hiện có.
 */
@Injectable()
export class DurableStateService {
  private readonly logger = new Logger(DurableStateService.name);
  private readonly checkpointer: SessionStoreCheckpointer;

  constructor(
    private readonly runEventStore: SqliteRunEventStore,
    private readonly sessionStore: SqliteSessionStore,
  ) {
    this.checkpointer = new SessionStoreCheckpointer({
      saveSnapshot: (runId, state) => this.runEventStore.saveSnapshot(runId, state),
      getSnapshot: async (runId) => {
        const snap = await this.runEventStore.getSnapshot(runId);
        if (!snap) return null;
        return { state: snap.state as Record<string, unknown> };
      },
    });
  }

  /** Lấy checkpointer đã khởi tạo (dùng cho các executor khác nếu cần). */
  getCheckpointer(): SessionStoreCheckpointer {
    return this.checkpointer;
  }

  /**
   * Tạo StateGraphExecutor cho một graph definition.
   *
   * @param definition - StateGraphDefinition đã build từ @vinhnt-sdk/durable-state
   * @param checkpointerOverride - checkpointer tùy chọn (mặc định dùng SQLite-backed)
   */
  createExecutor(
    definition: StateGraphDefinition,
    checkpointerOverride?: SessionStoreCheckpointer,
  ): StateGraphExecutor {
    const cp = checkpointerOverride ?? this.checkpointer;
    return new StateGraphExecutor(definition, cp);
  }

  /**
   * Chuyển SerializedRunState (từ run loop hiện có) sang StateSnapshot
   * để lưu vào durable-state checkpoint.
   */
  toSnapshot(runState: SerializedRunState, config: GraphConfig): StateSnapshot {
    return runStateToSnapshot(runState, config);
  }

  /**
   * Chuyển StateSnapshot ngược lại thành SerializedRunState để đưa vào run loop.
   */
  toRunState(snapshot: StateSnapshot): SerializedRunState {
    return snapshotToRunState(snapshot);
  }

  /**
   * Tạo snapshot ban đầu từ graph definition.
   */
  initialSnapshot(definition: StateGraphDefinition, config: GraphConfig): StateSnapshot {
    return snapshotFromDefinition(definition, config);
  }

  /**
   * Áp dụng PartialState delta lên snapshot qua reducers.
   */
  applyDelta(
    definition: StateGraphDefinition,
    snapshot: StateSnapshot,
    delta: Record<string, unknown>,
  ): StateSnapshot {
    return applyDeltaToSnapshot(definition, snapshot, delta);
  }

  /**
   * Lấy lịch sử checkpoint của một thread (sessionId) — dùng cho time-travel UI.
   */
  async history(threadId: string): Promise<readonly StateSnapshot[]> {
    try {
      return await this.checkpointer.list(threadId);
    } catch (err) {
      this.logger.error(
        `Failed to list durable-state snapshots for thread ${threadId}`,
        err as Error,
      );
      return [];
    }
  }

  /**
   * Lấy snapshot mới nhất của một thread (runId).
   */
  async getLatest(threadId: string): Promise<StateSnapshot | null> {
    try {
      return await this.checkpointer.getTuple({ threadId, checkpointNs: '' });
    } catch (err) {
      this.logger.error(
        `Failed to get latest durable-state snapshot for thread ${threadId}`,
        err as Error,
      );
      return null;
    }
  }

  /**
   * Resume a durable graph from an interrupt with a Command value.
   * Creates a fresh executor from the checkpointer and resumes execution.
   */
  async resume(
    definition: StateGraphDefinition,
    threadId: string,
    command: Command,
  ): Promise<StepResult> {
    const executor = this.createExecutor(definition);
    return executor.resume({ threadId, checkpointNs: '' }, command);
  }
}
