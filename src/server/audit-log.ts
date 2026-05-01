/**
 * m'AI Touch — Privacy Audit Log
 * 
 * Tracks all NLP processing decisions for compliance and transparency.
 * Records which commands were processed locally vs cloud,
 * privacy assessments, and data handling decisions.
 * 
 * Created by Peter Yang
 */

import type { PrivacyLevel, ProcessingTier, NLPResult } from '@/lib/engine';

export interface AuditEntry {
  id: string;
  timestamp: number;
  inputHash: string;         // SHA-like hash, never stores raw input for restricted
  inputPreview: string;      // First 50 chars or "[REDACTED]" for restricted
  language: string;
  primaryIntent: string;
  privacyLevel: PrivacyLevel;
  privacyScore: number;
  processingTier: ProcessingTier;
  actualTier: ProcessingTier; // Where it was actually processed
  nodeId: string;
  processingTimeMs: number;
  containsPII: boolean;
  entityCount: number;
  sentiment: string;
  reasons: string[];
  success: boolean;
}

export interface AuditStats {
  totalEntries: number;
  localProcessed: number;
  cloudProcessed: number;
  hybridProcessed: number;
  byPrivacyLevel: Record<PrivacyLevel, number>;
  byIntent: Record<string, number>;
  avgProcessingTimeMs: number;
  piiDetectedCount: number;
  last24hEntries: number;
  last7dEntries: number;
}

class PrivacyAuditLog {
  private entries: AuditEntry[] = [];
  private maxEntries: number = 10000;

  /**
   * Record an NLP processing result
   */
  record(result: NLPResult, actualTier: ProcessingTier): AuditEntry {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      inputHash: this.hashInput(result.input),
      inputPreview: result.privacy.level === 'restricted'
        ? '[REDACTED]'
        : result.input.substring(0, 50) + (result.input.length > 50 ? '...' : ''),
      language: result.language,
      primaryIntent: result.intents[0]?.category || 'unknown',
      privacyLevel: result.privacy.level,
      privacyScore: result.privacy.score,
      processingTier: result.privacy.tier,
      actualTier,
      nodeId: result.nodeId,
      processingTimeMs: result.processingTimeMs,
      containsPII: result.privacy.containsPII,
      entityCount: result.entities.length,
      sentiment: result.sentiment.emotion,
      reasons: result.privacy.reasons,
      success: true,
    };

    this.entries.push(entry);

    // Trim old entries if exceeding max
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return entry;
  }

  /**
   * Get audit statistics
   */
  getStats(): AuditStats {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const byPrivacyLevel: Record<PrivacyLevel, number> = {
      public: 0,
      internal: 0,
      confidential: 0,
      restricted: 0,
    };

    const byIntent: Record<string, number> = {};
    let totalTime = 0;
    let piiCount = 0;
    let last24h = 0;
    let last7d = 0;
    let localCount = 0;
    let cloudCount = 0;
    let hybridCount = 0;

    for (const entry of this.entries) {
      byPrivacyLevel[entry.privacyLevel]++;
      byIntent[entry.primaryIntent] = (byIntent[entry.primaryIntent] || 0) + 1;
      totalTime += entry.processingTimeMs;
      if (entry.containsPII) piiCount++;
      if (now - entry.timestamp < day) last24h++;
      if (now - entry.timestamp < 7 * day) last7d++;

      switch (entry.actualTier) {
        case 'local': localCount++; break;
        case 'cloud': cloudCount++; break;
        case 'hybrid': hybridCount++; break;
      }
    }

    return {
      totalEntries: this.entries.length,
      localProcessed: localCount,
      cloudProcessed: cloudCount,
      hybridProcessed: hybridCount,
      byPrivacyLevel,
      byIntent,
      avgProcessingTimeMs: this.entries.length > 0 ? totalTime / this.entries.length : 0,
      piiDetectedCount: piiCount,
      last24hEntries: last24h,
      last7dEntries: last7d,
    };
  }

  /**
   * Get recent entries (for admin dashboard)
   */
  getRecentEntries(limit: number = 50): AuditEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  /**
   * Get entries filtered by criteria
   */
  getFilteredEntries(filters: {
    privacyLevel?: PrivacyLevel;
    tier?: ProcessingTier;
    intent?: string;
    hasPII?: boolean;
    since?: number;
    until?: number;
  }): AuditEntry[] {
    return this.entries.filter(e => {
      if (filters.privacyLevel && e.privacyLevel !== filters.privacyLevel) return false;
      if (filters.tier && e.actualTier !== filters.tier) return false;
      if (filters.intent && e.primaryIntent !== filters.intent) return false;
      if (filters.hasPII !== undefined && e.containsPII !== filters.hasPII) return false;
      if (filters.since && e.timestamp < filters.since) return false;
      if (filters.until && e.timestamp > filters.until) return false;
      return true;
    }).reverse();
  }

  /**
   * Export entries to CSV format
   */
  exportToCSV(startTime?: number, endTime?: number): string {
    const entries = this.getFilteredEntries({
      since: startTime,
      until: endTime
    });

    const headers = [
      "Timestamp",
      "ID",
      "Intent",
      "Privacy Level",
      "Processing Tier",
      "Actual Tier",
      "Processing Time (ms)",
      "Success",
      "Input Preview"
    ].join(",");

    const rows = entries.map(e => {
      const date = new Date(e.timestamp).toISOString();
      const input = e.inputPreview.replace(/"/g, '""'); // Escape quotes
      return [
        date,
        e.id,
        e.primaryIntent,
        e.privacyLevel,
        e.processingTier,
        e.actualTier,
        e.processingTimeMs,
        e.success,
        `"${input}"`
      ].join(",");
    });

    return [headers, ...rows].join("\n");
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Simple hash function for audit purposes
   */
  private hashInput(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `h${Math.abs(hash).toString(16).padStart(8, '0')}`;
  }
}

// Singleton
let auditLogInstance: PrivacyAuditLog | null = null;

export function getAuditLog(): PrivacyAuditLog {
  if (!auditLogInstance) {
    auditLogInstance = new PrivacyAuditLog();
  }
  return auditLogInstance;
}

export function resetAuditLog(): void {
  auditLogInstance = null;
}
