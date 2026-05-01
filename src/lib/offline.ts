/**
 * Offline Support Service
 * Handles offline data storage and sync for m'AI Touch
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { EventEmitter } from 'events';

export type OfflineOperation = {
  id: string;
  type: 'create_booking' | 'update_booking' | 'create_work_order' | 'update_work_order' | 'send_message';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
};

export type OfflineData = {
  amenities: any[];
  bookings: any[];
  workOrders: any[];
  chatMessages: any[];
  userProfile: any | null;
};

export class OfflineService extends EventEmitter {
  private static instance: OfflineService;
  private isOnline = true;
  private syncQueue: OfflineOperation[] = [];
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
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
        this.startSync();
      } else if (wasOnline && !this.isOnline) {
        // Went from online to offline
        this.emit('network:offline');
      }
    });
  }

  /**
   * Load sync queue from storage
   */
  private async loadSyncQueue(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem('@offline_sync_queue');
      if (queueJson) {
        this.syncQueue = JSON.parse(queueJson);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  /**
   * Save sync queue to storage
   */
  private async saveSyncQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('@offline_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Check if device is online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Add operation to sync queue
   */
  async queueOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const op: OfflineOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    this.syncQueue.push(op);
    await this.saveSyncQueue();
    this.emit('operation:queued', op);

    // If online, try to sync immediately
    if (this.isOnline) {
      this.startSync();
    }

    return op.id;
  }

  /**
   * Start sync process
   */
  async startSync(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0 || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.emit('sync:started');

    try {
      // Process operations in order
      for (let i = 0; i < this.syncQueue.length; i++) {
        const op = this.syncQueue[i];
        if (op.status === 'pending' || op.status === 'failed') {
          await this.processOperation(op);
        }
      }

      // Remove completed operations
      this.syncQueue = this.syncQueue.filter(op => op.status !== 'completed');
      await this.saveSyncQueue();

      this.emit('sync:completed');
    } catch (error) {
      console.error('Sync failed:', error);
      this.emit('sync:failed', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a single operation
   */
  private async processOperation(op: OfflineOperation): Promise<void> {
    try {
      op.status = 'processing';
      this.emit('operation:processing', op);

      // Simulate API call - in real implementation, this would call your actual API
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark as completed
      op.status = 'completed';
      this.emit('operation:completed', op);
    } catch (error) {
      op.status = 'failed';
      op.error = error instanceof Error ? error.message : 'Unknown error';
      op.retryCount++;

      if (op.retryCount >= 3) {
        this.emit('operation:failed', op);
      } else {
        // Retry later
        setTimeout(() => this.startSync(), 5000);
      }
    }
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.syncQueue.filter(op => op.status === 'pending' || op.status === 'failed').length;
  }

  /**
   * Get all operations
   */
  getOperations(): OfflineOperation[] {
    return [...this.syncQueue];
  }

  /**
   * Clear all operations
   */
  async clearOperations(): Promise<void> {
    this.syncQueue = [];
    await this.saveSyncQueue();
    this.emit('operations:cleared');
  }

  /**
   * Save data for offline use
   */
  async saveData<T extends keyof OfflineData>(key: T, data: OfflineData[T]): Promise<void> {
    try {
      await AsyncStorage.setItem(`@offline_data_${key}`, JSON.stringify(data));
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
      const dataJson = await AsyncStorage.getItem(`@offline_data_${key}`);
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