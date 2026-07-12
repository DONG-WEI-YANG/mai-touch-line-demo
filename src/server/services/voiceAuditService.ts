/**
 * Voice audit trail — records who/when/what for every voice command (proposal
 * and commit) so admins/property can review who booked / dispatched / controlled
 * what by voice, and why a commit was rejected.
 *
 * In-memory ring buffer, mirroring hardwareGatewayService's dispatchHistory. The
 * demo backend's SQLite is wiped on restart anyway (see the deploy-mechanics
 * memory), so a DB table would be no more durable in practice; the record()
 * boundary is isolated so it can be swapped to a persistent store later without
 * touching callers.
 */
export type VoiceAuditSource = "resident" | "staff";
export type VoiceAuditPhase = "command" | "commit";
export type VoiceAuditOutcome = "proposed" | "committed" | "rejected" | "unclear";

export type VoiceAuditRecordInput = {
  actorUserId: number;
  /** Set when staff act on behalf of a resident (property desk). */
  targetUserId?: number;
  source: VoiceAuditSource;
  phase: VoiceAuditPhase;
  intent: string;
  kind: string;
  outcome: VoiceAuditOutcome;
  transcript?: string;
  slots?: Record<string, unknown>;
  ref?: string;
  error?: string;
};

export type VoiceAuditEntry = VoiceAuditRecordInput & {
  id: number;
  timestamp: string;
};

export type VoiceAuditStats = {
  total: number;
  proposed: number;
  committed: number;
  rejected: number;
  unclear: number;
};

const DEFAULT_MAX = 200;

export class VoiceAuditService {
  private readonly maxSize: number;
  private readonly entries: VoiceAuditEntry[] = [];
  private nextId = 1;

  constructor(maxSize: number = DEFAULT_MAX) {
    this.maxSize = Number.isFinite(maxSize) && maxSize > 0 ? Math.trunc(maxSize) : DEFAULT_MAX;
  }

  record(input: VoiceAuditRecordInput): VoiceAuditEntry {
    const entry: VoiceAuditEntry = {
      ...input,
      id: this.nextId++,
      timestamp: new Date().toISOString(),
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.splice(0, this.entries.length - this.maxSize);
    }
    return entry;
  }

  /** Newest first. */
  getHistory(limit: number = this.maxSize): VoiceAuditEntry[] {
    const n = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), this.maxSize)) : this.maxSize;
    return this.entries.slice(-n).reverse();
  }

  getStats(): VoiceAuditStats {
    const stats: VoiceAuditStats = { total: this.entries.length, proposed: 0, committed: 0, rejected: 0, unclear: 0 };
    for (const e of this.entries) {
      if (e.outcome === "proposed") stats.proposed += 1;
      else if (e.outcome === "committed") stats.committed += 1;
      else if (e.outcome === "rejected") stats.rejected += 1;
      else if (e.outcome === "unclear") stats.unclear += 1;
    }
    return stats;
  }
}

export const voiceAuditService = new VoiceAuditService();
