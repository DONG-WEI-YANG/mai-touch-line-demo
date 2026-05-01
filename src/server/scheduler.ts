/**
 * m'AI Touch — NLP Node Pool Scheduler
 * 
 * Manages 300+ schedulable local Tiny NLP nodes with:
 * - Dynamic node provisioning and decommissioning
 * - Round-robin + least-load balancing
 * - Health monitoring with heartbeat
 * - Automatic failover and recovery
 * - Node type specialization (intent, entity, sentiment, etc.)
 * - Resource-aware scheduling (RAM optimization)
 * 
 * Created by Peter Yang
 */

import { processText, type NLPResult } from '@/lib/engine';

// ============================================================
// TYPES
// ============================================================

export type NodeStatus = 'idle' | 'busy' | 'degraded' | 'offline' | 'starting' | 'draining';

export type NodeType =
  | 'intent_classifier'
  | 'entity_extractor'
  | 'sentiment_analyzer'
  | 'privacy_scorer'
  | 'language_detector'
  | 'translation'
  | 'summarization'
  | 'keyword_extractor'
  | 'topic_modeler'
  | 'spell_corrector'
  | 'text_normalizer'
  | 'full_pipeline';

export interface NodeMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  lastLatencyMs: number;
  uptime: number;           // seconds
  memoryUsageMB: number;
  cpuUsagePercent: number;
}

export interface NLPNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  region: string;           // e.g., 'building-a', 'building-b', 'central'
  version: string;
  capacity: number;         // max concurrent requests
  currentLoad: number;      // current active requests
  metrics: NodeMetrics;
  lastHeartbeat: number;    // timestamp
  createdAt: number;
  tags: string[];
}

export interface SchedulerConfig {
  maxNodes: number;
  healthCheckIntervalMs: number;
  heartbeatTimeoutMs: number;
  maxRetries: number;
  loadBalanceStrategy: 'round_robin' | 'least_load' | 'weighted' | 'random';
  autoScaleEnabled: boolean;
  minIdleNodes: number;
  maxQueueSize: number;
  nodeTimeoutMs: number;
}

export interface SchedulerStats {
  totalNodes: number;
  activeNodes: number;
  idleNodes: number;
  busyNodes: number;
  degradedNodes: number;
  offlineNodes: number;
  totalRequestsProcessed: number;
  totalRequestsFailed: number;
  avgLatencyMs: number;
  throughputPerSecond: number;
  queueDepth: number;
  nodesByType: Record<NodeType, number>;
  nodesByRegion: Record<string, number>;
  uptime: number;
}

export interface QueuedRequest {
  id: string;
  text: string;
  priority: number;       // 0 = highest
  enqueuedAt: number;
  requiredNodeType?: NodeType;
  callback?: (result: NLPResult) => void;
}

// ============================================================
// NODE TYPE REGISTRY
// ============================================================

interface NodeTypeSpec {
  type: NodeType;
  displayName: string;
  description: string;
  baseMemoryMB: number;
  modelName: string;
  modelVersion: string;
  capabilities: string[];
  maxConcurrent: number;
}

export const NODE_TYPE_REGISTRY: NodeTypeSpec[] = [
  {
    type: 'intent_classifier',
    displayName: 'Intent Classifier',
    description: 'Rule-based + pattern matching intent classification for 14 categories',
    baseMemoryMB: 12,
    modelName: 'mai-intent-clf',
    modelVersion: 'v2.1.0',
    capabilities: ['classify_intent', 'sub_intent_detection'],
    maxConcurrent: 50,
  },
  {
    type: 'entity_extractor',
    displayName: 'Entity Extractor',
    description: 'Named entity recognition for persons, locations, dates, amenities, etc.',
    baseMemoryMB: 18,
    modelName: 'mai-ner',
    modelVersion: 'v1.8.0',
    capabilities: ['extract_entities', 'entity_linking'],
    maxConcurrent: 40,
  },
  {
    type: 'sentiment_analyzer',
    displayName: 'Sentiment Analyzer',
    description: 'Sentiment scoring and emotion detection (fatigue, urgency, discretion)',
    baseMemoryMB: 15,
    modelName: 'mai-sentiment',
    modelVersion: 'v1.5.0',
    capabilities: ['sentiment_score', 'emotion_detection', 'magnitude_analysis'],
    maxConcurrent: 45,
  },
  {
    type: 'privacy_scorer',
    displayName: 'Privacy Scorer',
    description: 'Assess privacy sensitivity and determine processing tier (local/cloud/hybrid)',
    baseMemoryMB: 10,
    modelName: 'mai-privacy',
    modelVersion: 'v2.0.0',
    capabilities: ['pii_detection', 'sensitivity_scoring', 'tier_routing'],
    maxConcurrent: 60,
  },
  {
    type: 'language_detector',
    displayName: 'Language Detector',
    description: 'Detect language (EN/ZH/mixed) with character-level analysis',
    baseMemoryMB: 8,
    modelName: 'mai-langdetect',
    modelVersion: 'v1.2.0',
    capabilities: ['language_identification', 'script_detection'],
    maxConcurrent: 80,
  },
  {
    type: 'translation',
    displayName: 'Translation Engine',
    description: 'Lightweight EN↔ZH translation for cross-language command processing',
    baseMemoryMB: 45,
    modelName: 'mai-translate-enzh',
    modelVersion: 'v1.0.0',
    capabilities: ['translate_en_zh', 'translate_zh_en'],
    maxConcurrent: 20,
  },
  {
    type: 'summarization',
    displayName: 'Text Summarizer',
    description: 'Extract key points from long text inputs or conversation history',
    baseMemoryMB: 35,
    modelName: 'mai-summarize',
    modelVersion: 'v1.1.0',
    capabilities: ['extractive_summary', 'key_phrase_extraction'],
    maxConcurrent: 25,
  },
  {
    type: 'keyword_extractor',
    displayName: 'Keyword Extractor',
    description: 'TF-IDF and rule-based keyword extraction for search and indexing',
    baseMemoryMB: 10,
    modelName: 'mai-keywords',
    modelVersion: 'v1.3.0',
    capabilities: ['keyword_extraction', 'phrase_ranking'],
    maxConcurrent: 55,
  },
  {
    type: 'topic_modeler',
    displayName: 'Topic Modeler',
    description: 'Classify text into predefined property management topics',
    baseMemoryMB: 20,
    modelName: 'mai-topic',
    modelVersion: 'v1.0.0',
    capabilities: ['topic_classification', 'theme_detection'],
    maxConcurrent: 35,
  },
  {
    type: 'spell_corrector',
    displayName: 'Spell Corrector',
    description: 'Correct common typos and autocomplete partial words',
    baseMemoryMB: 25,
    modelName: 'mai-spellcheck',
    modelVersion: 'v1.2.0',
    capabilities: ['spell_correction', 'autocomplete', 'fuzzy_match'],
    maxConcurrent: 40,
  },
  {
    type: 'text_normalizer',
    displayName: 'Text Normalizer',
    description: 'Normalize text input: lowercase, remove noise, standardize formats',
    baseMemoryMB: 6,
    modelName: 'mai-normalize',
    modelVersion: 'v1.0.0',
    capabilities: ['text_normalization', 'format_standardization'],
    maxConcurrent: 100,
  },
  {
    type: 'full_pipeline',
    displayName: 'Full Pipeline',
    description: 'Complete NLP pipeline: intent + entity + sentiment + privacy in one pass',
    baseMemoryMB: 48,
    modelName: 'mai-pipeline',
    modelVersion: 'v2.1.0',
    capabilities: ['full_analysis', 'combined_output'],
    maxConcurrent: 30,
  },
];

// ============================================================
// NODE POOL SCHEDULER
// ============================================================

const DEFAULT_CONFIG: SchedulerConfig = {
  maxNodes: 350,
  healthCheckIntervalMs: 5000,
  heartbeatTimeoutMs: 15000,
  maxRetries: 3,
  loadBalanceStrategy: 'least_load',
  autoScaleEnabled: true,
  minIdleNodes: 10,
  maxQueueSize: 1000,
  nodeTimeoutMs: 30000,
};

const REGIONS = [
  'tower-a', 'tower-b', 'tower-c', 'tower-d',
  'central-hub', 'amenity-center', 'parking-level',
  'security-office', 'concierge-desk', 'management-office',
];

export class NLPNodeScheduler {
  private nodes: Map<string, NLPNode> = new Map();
  private queue: QueuedRequest[] = [];
  private config: SchedulerConfig;
  private roundRobinIndex: number = 0;
  private startTime: number;
  private totalProcessed: number = 0;
  private totalFailed: number = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
  }

  // ---- Node Lifecycle ----

  /**
   * Initialize the node pool with a specified number of nodes
   */
  initializePool(nodeCount: number = 300): void {
    const count = Math.min(nodeCount, this.config.maxNodes);
    const typeSpecs = NODE_TYPE_REGISTRY;

    for (let i = 0; i < count; i++) {
      // Distribute node types based on demand profile
      const typeIndex = this.getDistributedTypeIndex(i, count, typeSpecs.length);
      const spec = typeSpecs[typeIndex];
      const region = REGIONS[i % REGIONS.length];

      const node: NLPNode = {
        id: `nlp-${region}-${spec.type.substring(0, 4)}-${String(i).padStart(4, '0')}`,
        type: spec.type,
        status: 'idle',
        region,
        version: spec.modelVersion,
        capacity: spec.maxConcurrent,
        currentLoad: 0,
        metrics: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          avgLatencyMs: 0,
          p95LatencyMs: 0,
          p99LatencyMs: 0,
          lastLatencyMs: 0,
          uptime: 0,
          memoryUsageMB: spec.baseMemoryMB + Math.random() * 5,
          cpuUsagePercent: Math.random() * 15,
        },
        lastHeartbeat: Date.now(),
        createdAt: Date.now(),
        tags: [spec.type, region, `v${spec.modelVersion}`],
      };

      this.nodes.set(node.id, node);
    }
  }

  /**
   * Distribute node types with weighted allocation based on expected demand
   */
  private getDistributedTypeIndex(nodeIndex: number, totalNodes: number, typeCount: number): number {
    // Weighted distribution: more intent classifiers and full pipeline nodes
    const weights = [
      18, // intent_classifier (high demand)
      12, // entity_extractor
      12, // sentiment_analyzer
      10, // privacy_scorer
      8,  // language_detector
      5,  // translation
      5,  // summarization
      8,  // keyword_extractor
      5,  // topic_modeler
      5,  // spell_corrector
      7,  // text_normalizer
      15, // full_pipeline (high demand)
    ];

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedPosition = (nodeIndex / totalNodes) * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (normalizedPosition < cumulative) {
        return Math.min(i, typeCount - 1);
      }
    }
    return typeCount - 1;
  }

  /**
   * Add a single node to the pool
   */
  addNode(type: NodeType, region?: string): NLPNode | null {
    if (this.nodes.size >= this.config.maxNodes) return null;

    const spec = NODE_TYPE_REGISTRY.find(s => s.type === type);
    if (!spec) return null;

    const nodeRegion = region || REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const nodeId = `nlp-${nodeRegion}-${type.substring(0, 4)}-${String(this.nodes.size).padStart(4, '0')}`;

    const node: NLPNode = {
      id: nodeId,
      type,
      status: 'starting',
      region: nodeRegion,
      version: spec.modelVersion,
      capacity: spec.maxConcurrent,
      currentLoad: 0,
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        lastLatencyMs: 0,
        uptime: 0,
        memoryUsageMB: spec.baseMemoryMB,
        cpuUsagePercent: 0,
      },
      lastHeartbeat: Date.now(),
      createdAt: Date.now(),
      tags: [type, nodeRegion],
    };

    // Simulate startup delay then set to idle
    setTimeout(() => {
      const n = this.nodes.get(nodeId);
      if (n && n.status === 'starting') n.status = 'idle';
    }, 500);

    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Remove a node from the pool (drain first)
   */
  removeNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    if (node.currentLoad > 0) {
      node.status = 'draining';
      return true;
    }

    this.nodes.delete(nodeId);
    return true;
  }

  // ---- Load Balancing ----

  /**
   * Select the best available node based on the configured strategy
   */
  selectNode(requiredType?: NodeType): NLPNode | null {
    const candidates = Array.from(this.nodes.values()).filter(n => {
      if (n.status !== 'idle' && n.status !== 'busy') return false;
      if (n.currentLoad >= n.capacity) return false;
      if (requiredType && n.type !== requiredType && n.type !== 'full_pipeline') return false;
      return true;
    });

    if (candidates.length === 0) return null;

    switch (this.config.loadBalanceStrategy) {
      case 'round_robin':
        return this.roundRobinSelect(candidates);
      case 'least_load':
        return this.leastLoadSelect(candidates);
      case 'weighted':
        return this.weightedSelect(candidates);
      case 'random':
        return candidates[Math.floor(Math.random() * candidates.length)];
      default:
        return this.leastLoadSelect(candidates);
    }
  }

  private roundRobinSelect(candidates: NLPNode[]): NLPNode {
    const index = this.roundRobinIndex % candidates.length;
    this.roundRobinIndex++;
    return candidates[index];
  }

  private leastLoadSelect(candidates: NLPNode[]): NLPNode {
    return candidates.reduce((best, node) => {
      const bestRatio = best.currentLoad / best.capacity;
      const nodeRatio = node.currentLoad / node.capacity;
      return nodeRatio < bestRatio ? node : best;
    });
  }

  private weightedSelect(candidates: NLPNode[]): NLPNode {
    // Weight by available capacity and recent performance
    const weights = candidates.map(n => {
      const availableCapacity = (n.capacity - n.currentLoad) / n.capacity;
      const performanceScore = n.metrics.avgLatencyMs > 0
        ? 1 / (1 + n.metrics.avgLatencyMs / 100)
        : 0.5;
      return availableCapacity * 0.7 + performanceScore * 0.3;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < candidates.length; i++) {
      random -= weights[i];
      if (random <= 0) return candidates[i];
    }

    return candidates[candidates.length - 1];
  }

  // ---- Request Processing ----

  /**
   * Process a text input through the NLP pipeline
   */
  async processRequest(text: string, requiredType?: NodeType, priority: number = 5): Promise<NLPResult | null> {
    const node = this.selectNode(requiredType);

    if (!node) {
      // Queue the request if no node available
      if (this.queue.length < this.config.maxQueueSize) {
        return new Promise((resolve) => {
          this.queue.push({
            id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            text,
            priority,
            enqueuedAt: Date.now(),
            requiredNodeType: requiredType,
            callback: (result) => resolve(result),
          });
          this.queue.sort((a, b) => a.priority - b.priority);
        });
      }
      this.totalFailed++;
      return null;
    }

    return this.executeOnNode(node, text);
  }

  private async executeOnNode(node: NLPNode, text: string): Promise<NLPResult> {
    node.currentLoad++;
    node.status = node.currentLoad >= node.capacity ? 'busy' : node.status === 'idle' ? 'busy' : node.status;

    const startTime = Date.now();

    try {
      const result = processText(text, node.id);
      const latency = Date.now() - startTime;

      // Update metrics
      node.metrics.totalRequests++;
      node.metrics.successfulRequests++;
      node.metrics.lastLatencyMs = latency;
      node.metrics.avgLatencyMs = (
        (node.metrics.avgLatencyMs * (node.metrics.totalRequests - 1) + latency) /
        node.metrics.totalRequests
      );
      node.metrics.p95LatencyMs = Math.max(node.metrics.p95LatencyMs, latency * 0.95);
      node.metrics.p99LatencyMs = Math.max(node.metrics.p99LatencyMs, latency * 0.99);

      // Simulate resource usage fluctuation
      node.metrics.cpuUsagePercent = Math.min(95, node.metrics.cpuUsagePercent + Math.random() * 5);
      node.metrics.memoryUsageMB += Math.random() * 0.5;

      this.totalProcessed++;
      node.lastHeartbeat = Date.now();

      return result;
    } catch (error) {
      node.metrics.totalRequests++;
      node.metrics.failedRequests++;
      this.totalFailed++;

      // Mark node as degraded if failure rate is high
      const failRate = node.metrics.failedRequests / node.metrics.totalRequests;
      if (failRate > 0.3 && node.metrics.totalRequests > 5) {
        node.status = 'degraded';
      }

      throw error;
    } finally {
      node.currentLoad--;
      if (node.currentLoad === 0 && node.status === 'busy') {
        node.status = 'idle';
      }
      if (node.status === 'draining' && node.currentLoad === 0) {
        this.nodes.delete(node.id);
      }

      // Process queued requests
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0) return;

    const request = this.queue[0];
    const node = this.selectNode(request.requiredNodeType);

    if (node) {
      this.queue.shift();
      this.executeOnNode(node, request.text).then(result => {
        request.callback?.(result);
      });
    }
  }

  // ---- Health Monitoring ----

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(() => {
      this.runHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Run a single health check across all nodes
   */
  runHealthCheck(): void {
    const now = Date.now();

    for (const [_id, node] of this.nodes) {
      // Update uptime
      node.metrics.uptime = (now - node.createdAt) / 1000;

      // Check heartbeat timeout
      if (now - node.lastHeartbeat > this.config.heartbeatTimeoutMs) {
        if (node.status !== 'offline') {
          node.status = 'offline';
        }
      }

      // Simulate gradual resource recovery for idle nodes
      if (node.status === 'idle' && node.currentLoad === 0) {
        node.metrics.cpuUsagePercent = Math.max(1, node.metrics.cpuUsagePercent * 0.95);
        node.metrics.memoryUsageMB = Math.max(
          NODE_TYPE_REGISTRY.find(s => s.type === node.type)?.baseMemoryMB || 10,
          node.metrics.memoryUsageMB * 0.99,
        );
      }

      // Auto-recover degraded nodes that have been stable
      if (node.status === 'degraded') {
        const recentFailRate = node.metrics.failedRequests / Math.max(node.metrics.totalRequests, 1);
        if (recentFailRate < 0.1) {
          node.status = 'idle';
        }
      }

      // Refresh heartbeat for non-offline nodes (simulated)
      if (node.status !== 'offline') {
        node.lastHeartbeat = now;
      }
    }

    // Auto-scale: ensure minimum idle nodes
    if (this.config.autoScaleEnabled) {
      const idleCount = Array.from(this.nodes.values()).filter(n => n.status === 'idle').length;
      if (idleCount < this.config.minIdleNodes && this.nodes.size < this.config.maxNodes) {
        const toAdd = Math.min(
          this.config.minIdleNodes - idleCount,
          this.config.maxNodes - this.nodes.size,
        );
        for (let i = 0; i < toAdd; i++) {
          this.addNode('full_pipeline');
        }
      }
    }
  }

  // ---- Statistics & Monitoring ----

  /**
   * Get comprehensive scheduler statistics
   */
  getStats(): SchedulerStats {
    const nodes = Array.from(this.nodes.values());
    const now = Date.now();

    const nodesByType: Record<string, number> = {};
    const nodesByRegion: Record<string, number> = {};

    let totalLatency = 0;
    let latencyCount = 0;

    for (const node of nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
      nodesByRegion[node.region] = (nodesByRegion[node.region] || 0) + 1;

      if (node.metrics.avgLatencyMs > 0) {
        totalLatency += node.metrics.avgLatencyMs;
        latencyCount++;
      }
    }

    const uptimeSeconds = (now - this.startTime) / 1000;

    return {
      totalNodes: nodes.length,
      activeNodes: nodes.filter(n => n.status === 'idle' || n.status === 'busy').length,
      idleNodes: nodes.filter(n => n.status === 'idle').length,
      busyNodes: nodes.filter(n => n.status === 'busy').length,
      degradedNodes: nodes.filter(n => n.status === 'degraded').length,
      offlineNodes: nodes.filter(n => n.status === 'offline').length,
      totalRequestsProcessed: this.totalProcessed,
      totalRequestsFailed: this.totalFailed,
      avgLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      throughputPerSecond: uptimeSeconds > 0 ? this.totalProcessed / uptimeSeconds : 0,
      queueDepth: this.queue.length,
      nodesByType: nodesByType as Record<NodeType, number>,
      nodesByRegion,
      uptime: uptimeSeconds,
    };
  }

  /**
   * Get all nodes (for admin dashboard)
   */
  getAllNodes(): NLPNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes filtered by type, status, or region
   */
  getFilteredNodes(filters: {
    type?: NodeType;
    status?: NodeStatus;
    region?: string;
  }): NLPNode[] {
    return Array.from(this.nodes.values()).filter(n => {
      if (filters.type && n.type !== filters.type) return false;
      if (filters.status && n.status !== filters.status) return false;
      if (filters.region && n.region !== filters.region) return false;
      return true;
    });
  }

  /**
   * Get a specific node by ID
   */
  getNode(nodeId: string): NLPNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get total estimated memory usage across all nodes
   */
  getTotalMemoryUsageMB(): number {
    return Array.from(this.nodes.values())
      .reduce((total, node) => total + node.metrics.memoryUsageMB, 0);
  }

  /**
   * Get the node type registry
   */
  getNodeTypeRegistry(): NodeTypeSpec[] {
    return NODE_TYPE_REGISTRY;
  }

  /**
   * Reset all node metrics (for testing)
   */
  resetMetrics(): void {
    for (const node of this.nodes.values()) {
      node.metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        lastLatencyMs: 0,
        uptime: (Date.now() - node.createdAt) / 1000,
        memoryUsageMB: NODE_TYPE_REGISTRY.find(s => s.type === node.type)?.baseMemoryMB || 10,
        cpuUsagePercent: Math.random() * 5,
      };
    }
    this.totalProcessed = 0;
    this.totalFailed = 0;
  }

  /**
   * Shutdown the scheduler
   */
  shutdown(): void {
    this.stopHealthChecks();
    this.queue = [];
    this.nodes.clear();
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let schedulerInstance: NLPNodeScheduler | null = null;

export function getScheduler(config?: Partial<SchedulerConfig>): NLPNodeScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new NLPNodeScheduler(config);
    schedulerInstance.initializePool(300);
    schedulerInstance.startHealthChecks();
  }
  return schedulerInstance;
}

export function resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.shutdown();
    schedulerInstance = null;
  }
}
