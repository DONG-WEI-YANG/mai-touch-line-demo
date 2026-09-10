/**
 * Offline Support Service
 * Handles offline data storage and sync for m'AI Touch
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { EventEmitter } from 'events';
import { parseOfflineQueue } from './offline-schema';

// We only consume `isConnected` (OS/browser connectivity events), never
// `isInternetReachable`, so NetInfo's active reachability probe is pure
// overhead. On web it HEAD-polls the origin root every few seconds, which
// 404s forever when the app is served from a subpath (GitHub Pages).
NetInfo.configure({ reachabilityShouldRun: () => false });

export type OfflineOperationType =
  | 'create_booking'
  | 'update_booking'
  | 'cancel_booking'
  | 'create_work_order'
  | 'update_work_order'
  | 'send_message';

export type OfflineOperation = {
  owner?: string;
  id: string;
  type: OfflineOperationType;
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
};

/** Caller-supplied function that actually executes the queued operation against
 *  whatever transport (tRPC, REST, etc.) the app uses. Throws on failure to
 *  trigger retry; resolves on success. App registers this at boot via
 *  `offlineService.setOperationHandler(...)`. */
export type OfflineOperationHandler = (op: OfflineOperation) => Promise<void>;

const MAX_RETRIES = 3;
const SYNC_QUEUE_KEY = '@offline_sync_queue';
const QUARANTINE_KEY = '@offline_sync_quarantine';

export type OfflineData = {
  amenities: any[];
  bookings: any[];
  workOrders: any[];
  chatMessages: any[];
  userProfile: any | null;
};

export interface OfflineQueueSnapshot {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  totalCount: number;
  lastSyncAt: number | null;
}

export class OfflineService extends EventEmitter {
  private static instance: OfflineService;
  private isOnline = true;
  private syncQueue: OfflineOperation[] = [];
  private isSyncing = false;
  private syncPromise: Promise<void> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private operationHandler: OfflineOperationHandler | null = null;
  private ownerResolver: (() => Promise<string | null>) | null = null;
  private visibleOwner: string | null = null;
  private ownerGeneration = 0;
  setOwnerResolver(resolver: () => Promise<string | null>): void { this.ownerResolver = resolver; void this.refreshOwner(); }
  async refreshOwner(): Promise<void> {
    const generation = ++this.ownerGeneration;
    this.visibleOwner = null;
    this.notifyStatus();
    let owner: string | null = null;
    try { owner = this.ownerResolver ? await this.ownerResolver() : null; }
    catch { /* Keep private data hidden when account resolution fails. */ }
    if (generation !== this.ownerGeneration) return;
    this.visibleOwner = owner;
    this.notifyStatus();
  }
  private visibleOperations(): OfflineOperation[] {
    return this.ownerResolver ? this.syncQueue.filter(op=>!!this.visibleOwner && op.owner===this.visibleOwner) : this.syncQueue;
  }
  private lastSyncAt: number | null = null;

  // Public for testability — but treat `getInstance()` as the canonical entry
  // point in app code so we share one queue + one network listener.
  constructor() {
    super();
    this.setupNetworkListener();
    this.loadSyncQueue();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /** Register the function that actually performs each queued operation.
   *  App boot (`_layout.tsx`) calls this once with a closure that knows how
   *  to dispatch each op type via tRPC. Without a handler, queued operations
   *  simply remain pending until one is registered or the queue is cleared. */
  setOperationHandler(handler: OfflineOperationHandler | null): void {
    this.operationHandler = handler;
  }

  hasOperationHandler(): boolean {
    return this.operationHandler !== null;
  }

  /**
   * Setup network connectivity listener
   */
  private async setupNetworkListener(): Promise<void> {
    // Initial network state
    const netInfoState = await NetInfo.fetch();
    this.isOnline = netInfoState.isConnected ?? false;

    // Subscribe to network changes
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (!wasOnline && this.isOnline) {
        // Went from offline to online - trigger sync
        this.emit('network:online');
        void this.startSync();
      } else if (wasOnline && !this.isOnline) {
        // Went from online to offline
        this.emit('network:offline');
      }
      this.notifyStatus();
    });
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const parsed = parseOfflineQueue(queueJson);
      let requiresRewrite = parsed.quarantined.length > 0;
      this.syncQueue = parsed.operations
        .filter((operation) => {
          if (operation.status === 'completed') {
            requiresRewrite = true;
            return false;
          }
          return true;
        })
        .map((operation) => {
          if (operation.status !== 'processing') return operation;
          requiresRewrite = true;
          return { ...operation, status: 'pending' as const };
        });
      if (parsed.quarantined.length > 0) {
        const report = {
          quarantinedAt: Date.now(),
          count: parsed.quarantined.length,
          findings: parsed.quarantined,
        };
        await AsyncStorage.setItem(QUARANTINE_KEY, JSON.stringify(report));
        this.emit('queue:quarantined', report);
      }
      if (requiresRewrite) await this.saveSyncQueue();
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    } finally {
      this.notifyStatus();
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
      throw error;
    }
  }

  /**
   * Check if device is online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  getSnapshot(): Readonly<OfflineQueueSnapshot> {
    return Object.freeze({
      online: this.isOnline,
      syncing: this.isSyncing,
      pendingCount: this.visibleOperations().filter((op) => op.status === 'pending').length,
      failedCount: this.visibleOperations().filter((op) => op.status === 'failed').length,
      totalCount: this.visibleOperations().length,
      lastSyncAt: this.lastSyncAt,
    });
  }

  subscribe(listener: () => void): () => void {
    this.on('status:changed', listener);
    return () => this.off('status:changed', listener);
  }

  private notifyStatus(): void {
    this.emit('status:changed');
  }

  /**
   * Add operation to sync queue
   */
  async queueOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const generation = this.ownerGeneration;
    const owner = this.ownerResolver ? await this.ownerResolver() : undefined;
    if (this.ownerResolver && generation === this.ownerGeneration) this.visibleOwner = owner ?? null;
    if (this.ownerResolver && !owner) throw new Error('請登入後再使用離線操作');
    const op: OfflineOperation = {
      ...operation,
      owner: owner ?? undefined,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.syncQueue.push(op);
    try {
      await this.saveSyncQueue();
    } catch (error) {
      this.syncQueue = this.syncQueue.filter((queued) => queued.id !== op.id);
      throw error;
    }
    this.emit('operation:queued', op);
    this.notifyStatus();

    // If online, try to sync immediately
    if (this.isOnline) {
      void this.startSync();
    }

    return op.id;
  }

  /**
   * Start sync process
   */
  startSync(): Promise<void> {
    if (this.syncPromise) return this.syncPromise;
    if (this.syncQueue.length === 0 || !this.isOnline) return Promise.resolve();
    const running = this.runSync().finally(() => {
      if (this.syncPromise === running) this.syncPromise = null;
    });
    this.syncPromise = running;
    return running;
  }

  private async runSync(): Promise<void> {
    this.isSyncing = true;
    this.emit('sync:started');
    this.notifyStatus();

    try {
      const completed: OfflineOperation[] = [];
      // Process operations in order. Skip failed ops that have exhausted
      // retries — they need user intervention (clearOperations) or reset.
      for (let i = 0; i < this.syncQueue.length; i++) {
        const op = this.syncQueue[i];
        if (op.status === 'pending') {
          if (await this.processOperation(op)) completed.push(op);
        } else if (op.status === 'failed' && op.retryCount < MAX_RETRIES) {
          if (await this.processOperation(op)) completed.push(op);
        }
      }

      // Each successful entry was first persisted as `completed`. Removing it
      // is a second durable write, so a crash can never resurrect it as pending.
      this.syncQueue = this.syncQueue.filter(op => op.status !== 'completed');
      await this.saveSyncQueue();
      completed.forEach((op) => this.emit('operation:completed', op));

      this.lastSyncAt = Date.now();
      this.emit('sync:completed');
    } catch (error) {
      console.error('Sync failed:', error);
      this.emit('sync:failed', error);
    } finally {
      this.isSyncing = false;
      this.notifyStatus();
    }
  }

  /**
   * Process a single operation by delegating to the registered handler.
   * Without a handler, the op stays pending — we never silently mark it
   * completed (the previous implementation did, which was a data-loss bug).
   */
  private async processOperation(op: OfflineOperation): Promise<boolean> {
    if (this.ownerResolver && (!op.owner || op.owner !== await this.ownerResolver())) return false;
    if (!this.operationHandler) {
      op.status = 'pending';
      this.emit('operation:pending', op);
      return false;
    }

    op.status = 'processing';
    await this.saveSyncQueue();
    this.emit('operation:processing', op);
    this.notifyStatus();

    try {
      await this.operationHandler(op);
      op.status = 'completed';
      op.error = undefined;
      await this.saveSyncQueue();
      this.notifyStatus();
      return true;
    } catch (error) {
      op.status = 'failed';
      op.error = error instanceof Error ? error.message : 'Unknown error';
      op.retryCount++;
      await this.saveSyncQueue();
      this.notifyStatus();

      if (op.retryCount >= MAX_RETRIES) {
        this.emit('operation:failed', op);
      } else {
        // Retry later — but only if still online; otherwise wait for the
        // network:online event to retrigger startSync().
        if (this.isOnline) {
          setTimeout(() => this.startSync(), 5000);
        }
      }
      return false;
    }
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.visibleOperations().filter(op => op.status === 'pending' || op.status === 'failed').length;
  }

  /**
   * Get all operations
   */
  getOperations(): OfflineOperation[] {
    return [...this.visibleOperations()];
  }

  async retryOperation(id: string): Promise<boolean> {
    if (this.ownerResolver) await this.refreshOwner();
    const operation = this.visibleOperations().find((item) => item.id === id && item.status === 'failed');
    if (!operation) return false;
    const previous = { ...operation };
    operation.status = 'pending';
    operation.retryCount = 0;
    operation.error = undefined;
    try {
      await this.saveSyncQueue();
    } catch (error) {
      Object.assign(operation, previous);
      throw error;
    }
    this.emit('operation:retried', operation);
    this.notifyStatus();
    if (this.isOnline) void this.startSync();
    return true;
  }

  async retryAllFailed(): Promise<number> {
    if (this.ownerResolver) await this.refreshOwner();
    const failed = this.visibleOperations().filter((operation) => operation.status === 'failed');
    if (failed.length === 0) return 0;
    const previous = failed.map((operation) => ({ operation, snapshot: { ...operation } }));
    failed.forEach((operation) => {
      operation.status = 'pending';
      operation.retryCount = 0;
      operation.error = undefined;
    });
    try {
      await this.saveSyncQueue();
    } catch (error) {
      previous.forEach(({ operation, snapshot }) => Object.assign(operation, snapshot));
      throw error;
    }
    failed.forEach((operation) => this.emit('operation:retried', operation));
    this.notifyStatus();
    if (this.isOnline) void this.startSync();
    return failed.length;
  }

  /**
   * Clear all operations
   */
  async clearOperations(): Promise<void> {
    if (this.ownerResolver) await this.refreshOwner();
    const visible = new Set(this.visibleOperations());
    this.syncQueue = this.syncQueue.filter(op=>!visible.has(op));
    await this.saveSyncQueue();
    this.emit('operations:cleared');
    this.notifyStatus();
  }

  /**
   * Save data for offline use
   */
  async saveData<T extends keyof OfflineData>(key: T, data: OfflineData[T]): Promise<void> {
    try {
      const owner=this.ownerResolver?await this.ownerResolver():undefined;
      if(this.ownerResolver&&!owner) throw new Error('請登入後儲存離線資料');
      await AsyncStorage.setItem(`@offline_data_${owner ? owner+'_' : ''}${key}`, JSON.stringify(data));
      this.emit('data:saved', { key, data });
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
      throw error;
    }
  }

  /**
   * Load data for offline use
   */
  async loadData<T extends keyof OfflineData>(key: T): Promise<OfflineData[T] | null> {
    try {
      const generation = this.ownerGeneration;
      const owner=this.ownerResolver?await this.ownerResolver():undefined;
      if(this.ownerResolver&&!owner) return null;
      const dataJson = await AsyncStorage.getItem(`@offline_data_${owner ? owner+'_' : ''}${key}`);
      if (generation !== this.ownerGeneration || (this.ownerResolver && owner !== await this.ownerResolver())) return null;
      return dataJson ? JSON.parse(dataJson) : null;
    } catch (error) {
      console.error(`Failed to load ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAllData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(key => key.startsWith('@offline_'));
      await AsyncStorage.multiRemove(offlineKeys);
      this.emit('data:cleared');
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }

  /**
   * Start auto-sync interval
   */
  startAutoSync(intervalMs: number = 30000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.getPendingCount() > 0) {
        this.startSync();
      }
    }, intervalMs);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAutoSync();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const offlineService = OfflineService.getInstance();
