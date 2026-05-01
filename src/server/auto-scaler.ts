/**
 * m'AI Touch — NLP Node Auto-Scaler
 * 
 * Dynamically adjusts the number of active NLP nodes based on
 * time-of-day usage patterns and real-time demand metrics.
 * 
 * Key features:
 * - Peak/off-peak scheduling (configurable time windows)
 * - Gradual scale-up/down to avoid resource spikes
 * - RAM usage optimization (reduce ~50% during off-peak)
 * - Real-time demand-based scaling overrides
 * - Scaling history for admin dashboard monitoring
 * 
 * Created by Peter Yang
 */

import { getScheduler, type NLPNodeScheduler, type NodeType } from './scheduler';

// ============================================================
// TYPES
// ============================================================

export type ScalingPeriod = 'peak' | 'standard' | 'off_peak' | 'night';

export interface TimeWindow {
  /** Start hour (0-23) */
  startHour: number;
  /** End hour (0-23, exclusive) */
  endHour: number;
  /** Period classification */
  period: ScalingPeriod;
  /** Target node count for this period */
  targetNodes: number;
  /** Min idle nodes to maintain */
  minIdleNodes: number;
  /** Description */
  label: string;
  /** Chinese label */
  labelCN: string;
}

export interface ScalingEvent {
  id: string;
  timestamp: number;
  fromPeriod: ScalingPeriod;
  toPeriod: ScalingPeriod;
  fromNodeCount: number;
  toNodeCount: number;
  reason: string;
  estimatedRAMSavingMB: number;
  duration: number; // ms to complete scaling
}

export interface AutoScalerConfig {
  /** Enable/disable auto-scaling */
  enabled: boolean;
  /** Time windows defining scaling periods */
  timeWindows: TimeWindow[];
  /** Check interval in ms (default: 60000 = 1 min) */
  checkIntervalMs: number;
  /** Max nodes to add/remove per scaling step */
  stepSize: number;
  /** Cooldown between scaling events in ms */
  cooldownMs: number;
  /** Demand threshold: if queue > this, scale up regardless of schedule */
  demandQueueThreshold: number;
  /** Demand threshold: if avg latency > this ms, scale up */
  demandLatencyThresholdMs: number;
  /** RAM per node estimate in MB (for reporting) */
  estimatedRAMPerNodeMB: number;
}

export interface AutoScalerStats {
  enabled: boolean;
  currentPeriod: ScalingPeriod;
  currentPeriodLabel: string;
  currentPeriodLabelCN: string;
  targetNodes: number;
  actualNodes: number;
  isScaling: boolean;
  scalingDirection: 'up' | 'down' | 'stable';
  nextPeriodChange: { period: ScalingPeriod; inMinutes: number } | null;
  estimatedRAMUsageMB: number;
  estimatedRAMSavingMB: number;
  peakRAMUsageMB: number;
  recentEvents: ScalingEvent[];
  totalScaleUpEvents: number;
  totalScaleDownEvents: number;
  demandOverrideActive: boolean;
}

// ============================================================
// DEFAULT CONFIGURATION
// ============================================================

const DEFAULT_TIME_WINDOWS: TimeWindow[] = [
  {
    startHour: 6,
    endHour: 9,
    period: 'standard',
    targetNodes: 250,
    minIdleNodes: 20,
    label: 'Morning Standard',
    labelCN: '早間標準',
  },
  {
    startHour: 9,
    endHour: 12,
    period: 'standard',
    targetNodes: 280,
    minIdleNodes: 25,
    label: 'Mid-Morning',
    labelCN: '上午時段',
  },
  {
    startHour: 12,
    endHour: 14,
    period: 'peak',
    targetNodes: 320,
    minIdleNodes: 30,
    label: 'Lunch Peak',
    labelCN: '午餐高峰',
  },
  {
    startHour: 14,
    endHour: 18,
    period: 'standard',
    targetNodes: 260,
    minIdleNodes: 20,
    label: 'Afternoon Standard',
    labelCN: '下午標準',
  },
  {
    startHour: 18,
    endHour: 22,
    period: 'peak',
    targetNodes: 350,
    minIdleNodes: 35,
    label: 'Evening Peak',
    labelCN: '晚間高峰',
  },
  {
    startHour: 22,
    endHour: 2,
    period: 'off_peak',
    targetNodes: 180,
    minIdleNodes: 10,
    label: 'Late Night',
    labelCN: '深夜離峰',
  },
  {
    startHour: 2,
    endHour: 6,
    period: 'night',
    targetNodes: 120,
    minIdleNodes: 5,
    label: 'Night Minimum',
    labelCN: '夜間最低',
  },
];

const DEFAULT_CONFIG: AutoScalerConfig = {
  enabled: true,
  timeWindows: DEFAULT_TIME_WINDOWS,
  checkIntervalMs: 60000,
  stepSize: 20,
  cooldownMs: 120000,
  demandQueueThreshold: 50,
  demandLatencyThresholdMs: 500,
  estimatedRAMPerNodeMB: 2.5,
};

// ============================================================
// AUTO-SCALER ENGINE
// ============================================================

export class NLPAutoScaler {
  private config: AutoScalerConfig;
  private scheduler: NLPNodeScheduler;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private events: ScalingEvent[] = [];
  private maxEvents: number = 500;
  private lastScaleTime: number = 0;
  private totalScaleUp: number = 0;
  private totalScaleDown: number = 0;
  private demandOverrideActive: boolean = false;
  private peakRAMUsageMB: number = 0;

  constructor(config?: Partial<AutoScalerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.scheduler = getScheduler();
  }

  // ---- Core Scaling Logic ----

  /**
   * Get the current time window based on hour of day
   */
  getCurrentWindow(hour?: number): TimeWindow {
    const currentHour = hour ?? new Date().getHours();

    for (const window of this.config.timeWindows) {
      if (window.startHour < window.endHour) {
        // Normal range (e.g., 9-12)
        if (currentHour >= window.startHour && currentHour < window.endHour) {
          return window;
        }
      } else {
        // Wrapping range (e.g., 22-2)
        if (currentHour >= window.startHour || currentHour < window.endHour) {
          return window;
        }
      }
    }

    // Fallback to standard
    return {
      startHour: 0,
      endHour: 24,
      period: 'standard',
      targetNodes: 250,
      minIdleNodes: 15,
      label: 'Default',
      labelCN: '預設',
    };
  }

  /**
   * Get the next period change info
   */
  getNextPeriodChange(): { period: ScalingPeriod; inMinutes: number } | null {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentWindow = this.getCurrentWindow();

    // Find the next window
    let nextWindow: TimeWindow | null = null;
    let minMinutes = Infinity;

    for (const window of this.config.timeWindows) {
      if (window.period === currentWindow.period && window.startHour === currentWindow.startHour) continue;

      let minutesUntil: number;
      if (window.startHour > currentHour) {
        minutesUntil = (window.startHour - currentHour) * 60 - currentMinute;
      } else if (window.startHour < currentHour) {
        minutesUntil = (24 - currentHour + window.startHour) * 60 - currentMinute;
      } else {
        minutesUntil = 24 * 60 - currentMinute;
      }

      if (minutesUntil > 0 && minutesUntil < minMinutes) {
        minMinutes = minutesUntil;
        nextWindow = window;
      }
    }

    if (nextWindow) {
      return { period: nextWindow.period, inMinutes: Math.round(minMinutes) };
    }
    return null;
  }

  /**
   * Check demand metrics and determine if override scaling is needed
   */
  private checkDemandOverride(): boolean {
    const stats = this.scheduler.getStats();

    if (stats.queueDepth > this.config.demandQueueThreshold) {
      return true;
    }
    if (stats.avgLatencyMs > this.config.demandLatencyThresholdMs && stats.totalRequestsProcessed > 10) {
      return true;
    }
    return false;
  }

  /**
   * Perform a scaling check and adjust nodes if needed
   */
  performScalingCheck(): ScalingEvent | null {
    if (!this.config.enabled) return null;

    const now = Date.now();
    const currentWindow = this.getCurrentWindow();
    const stats = this.scheduler.getStats();
    const currentNodes = stats.totalNodes;

    // Check demand override
    const demandOverride = this.checkDemandOverride();
    this.demandOverrideActive = demandOverride;

    // Determine target
    let targetNodes = currentWindow.targetNodes;
    if (demandOverride) {
      // Scale up by 20% if demand is high
      targetNodes = Math.min(
        Math.round(targetNodes * 1.2),
        this.scheduler['config']?.maxNodes || 500,
      );
    }

    // Check if scaling is needed
    const diff = targetNodes - currentNodes;
    if (Math.abs(diff) < 5) return null; // Within tolerance

    // Check cooldown
    if (now - this.lastScaleTime < this.config.cooldownMs) return null;

    // Calculate step
    const step = Math.min(Math.abs(diff), this.config.stepSize);
    const startTime = Date.now();

    if (diff > 0) {
      // Scale UP
      const nodeTypes: NodeType[] = ['intent_classifier', 'entity_extractor', 'sentiment_analyzer', 'privacy_scorer', 'full_pipeline'];
      for (let i = 0; i < step; i++) {
        const type = nodeTypes[i % nodeTypes.length];
        this.scheduler.addNode(type);
      }
      this.totalScaleUp++;
    } else {
      // Scale DOWN - drain excess nodes
      const allNodes = this.scheduler.getAllNodes();
      const idleNodes = allNodes.filter(n => n.status === 'idle');
      const toRemove = Math.min(step, idleNodes.length);

      for (let i = 0; i < toRemove; i++) {
        this.scheduler.removeNode(idleNodes[i].id);
      }
      this.totalScaleDown++;
    }

    const duration = Date.now() - startTime;
    const newStats = this.scheduler.getStats();
    const ramSaving = diff < 0 ? Math.abs(diff) * this.config.estimatedRAMPerNodeMB : 0;

    // Track peak RAM
    const currentRAM = newStats.totalNodes * this.config.estimatedRAMPerNodeMB;
    if (currentRAM > this.peakRAMUsageMB) {
      this.peakRAMUsageMB = currentRAM;
    }

    const event: ScalingEvent = {
      id: `scale-${now}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      fromPeriod: this.getCurrentWindow()?.period || 'standard',
      toPeriod: currentWindow.period,
      fromNodeCount: currentNodes,
      toNodeCount: newStats.totalNodes,
      reason: demandOverride
        ? `Demand override: queue=${stats.queueDepth}, latency=${Math.round(stats.avgLatencyMs)}ms`
        : `Scheduled: ${currentWindow.label} (${currentWindow.startHour}:00-${currentWindow.endHour}:00)`,
      estimatedRAMSavingMB: Math.round(ramSaving),
      duration,
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.lastScaleTime = now;
    return event;
  }

  // ---- Lifecycle ----

  /**
   * Start the auto-scaler periodic checks
   */
  start(): void {
    if (this.checkTimer) return;
    this.checkTimer = setInterval(() => {
      this.performScalingCheck();
    }, this.config.checkIntervalMs);

    // Run initial check
    this.performScalingCheck();
  }

  /**
   * Stop the auto-scaler
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoScalerConfig>): void {
    this.config = { ...this.config, ...config };
    // Restart if running
    if (this.checkTimer) {
      this.stop();
      this.start();
    }
  }

  // ---- Statistics ----

  /**
   * Get comprehensive auto-scaler statistics
   */
  getStats(): AutoScalerStats {
    const currentWindow = this.getCurrentWindow();
    const schedulerStats = this.scheduler.getStats();
    const currentRAM = schedulerStats.totalNodes * this.config.estimatedRAMPerNodeMB;
    const peakRAM = DEFAULT_TIME_WINDOWS
      .reduce((max, w) => Math.max(max, w.targetNodes), 0) * this.config.estimatedRAMPerNodeMB;

    return {
      enabled: this.config.enabled,
      currentPeriod: currentWindow.period,
      currentPeriodLabel: currentWindow.label,
      currentPeriodLabelCN: currentWindow.labelCN,
      targetNodes: currentWindow.targetNodes,
      actualNodes: schedulerStats.totalNodes,
      isScaling: Math.abs(currentWindow.targetNodes - schedulerStats.totalNodes) > 5,
      scalingDirection: schedulerStats.totalNodes < currentWindow.targetNodes - 5
        ? 'up'
        : schedulerStats.totalNodes > currentWindow.targetNodes + 5
          ? 'down'
          : 'stable',
      nextPeriodChange: this.getNextPeriodChange(),
      estimatedRAMUsageMB: Math.round(currentRAM),
      estimatedRAMSavingMB: Math.round(peakRAM - currentRAM),
      peakRAMUsageMB: Math.round(this.peakRAMUsageMB || peakRAM),
      recentEvents: this.events.slice(-20).reverse(),
      totalScaleUpEvents: this.totalScaleUp,
      totalScaleDownEvents: this.totalScaleDown,
      demandOverrideActive: this.demandOverrideActive,
    };
  }

  /**
   * Get all scaling events
   */
  getEvents(): ScalingEvent[] {
    return [...this.events].reverse();
  }

  /**
   * Get the time windows configuration
   */
  getTimeWindows(): TimeWindow[] {
    return [...this.config.timeWindows];
  }

  /**
   * Get config
   */
  getConfig(): AutoScalerConfig {
    return { ...this.config };
  }
}

// ============================================================
// SINGLETON
// ============================================================

let autoScalerInstance: NLPAutoScaler | null = null;

export function getAutoScaler(config?: Partial<AutoScalerConfig>): NLPAutoScaler {
  if (!autoScalerInstance) {
    autoScalerInstance = new NLPAutoScaler(config);
  }
  return autoScalerInstance;
}

export function resetAutoScaler(): void {
  if (autoScalerInstance) {
    autoScalerInstance.stop();
    autoScalerInstance = null;
  }
}
