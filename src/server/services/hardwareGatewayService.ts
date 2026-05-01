type DispatchDeviceCommandInput = {
  deviceId: number;
  status: string;
  requestedBy: string;
  deviceName?: string;
  deviceType?: string;
  amenityId?: number | null;
  unitId?: number | null;
};

export type HardwareDispatchResult = {
  success: boolean;
  commandDispatched: boolean;
  fallbackUsed: boolean;
  reason?: string;
  statusCode?: number;
};

export type HardwareDispatchHistoryEntry = {
  id: number;
  timestamp: string;
  durationMs: number;
  adapterRequested: string;
  adapterResolved: ProtocolAdapterName | null;
  input: DispatchDeviceCommandInput;
  result: HardwareDispatchResult;
};

export type HardwareGatewayHealthInfo = {
  status: "healthy" | "degraded";
  config: {
    dryRun: boolean;
    strictMode: boolean;
    timeoutMs: number;
    adapterRequested: string;
    adapterResolved: ProtocolAdapterName | null;
    baseUrlConfigured: boolean;
    apiKeyConfigured: boolean;
  };
  counters: {
    totalDispatches: number;
    successfulDispatches: number;
    failedDispatches: number;
    dispatchedCommands: number;
    fallbackDispatches: number;
  };
  history: {
    size: number;
    maxSize: number;
    latestTimestamp: string | null;
  };
  lastFailureReason: string | null;
};

const DEFAULT_TIMEOUT_MS = 2500;
const DEFAULT_PROTOCOL_ADAPTER = "http";
const DEFAULT_DISPATCH_HISTORY_SIZE = 100;

type ProtocolAdapterName = "http" | "mqtt" | "modbus";

type AdapterDispatchContext = {
  strictMode: boolean;
  safeFallback: (reason: string, statusCode?: number) => HardwareDispatchResult;
};

interface HardwareProtocolAdapter {
  readonly name: ProtocolAdapterName;
  dispatch(
    input: DispatchDeviceCommandInput,
    context: AdapterDispatchContext,
  ): Promise<HardwareDispatchResult>;
}

class HttpHardwareProtocolAdapter implements HardwareProtocolAdapter {
  readonly name: ProtocolAdapterName = "http";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {}

  async dispatch(
    input: DispatchDeviceCommandInput,
    context: AdapterDispatchContext,
  ): Promise<HardwareDispatchResult> {
    if (!this.baseUrl) {
      return context.safeFallback("Hardware gateway URL is not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      Number.isFinite(this.timeoutMs) ? this.timeoutMs : DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${this.baseUrl}/commands/devices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          deviceId: input.deviceId,
          status: input.status,
          requestedBy: input.requestedBy,
          meta: {
            deviceName: input.deviceName,
            deviceType: input.deviceType,
            amenityId: input.amenityId ?? undefined,
            unitId: input.unitId ?? undefined,
          },
        }),
      });

      if (!response.ok) {
        const reason = `Hardware gateway rejected command (${response.status})`;
        if (context.strictMode) {
          return {
            success: false,
            commandDispatched: false,
            fallbackUsed: false,
            reason,
            statusCode: response.status,
          };
        }
        return context.safeFallback(reason, response.status);
      }

      return {
        success: true,
        commandDispatched: true,
        fallbackUsed: false,
        statusCode: response.status,
      };
    } catch (error) {
      const reason =
        error instanceof Error
          ? `Hardware gateway request failed: ${error.message}`
          : "Hardware gateway request failed";
      if (context.strictMode) {
        return {
          success: false,
          commandDispatched: false,
          fallbackUsed: false,
          reason,
        };
      }
      return context.safeFallback(reason);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

class MqttHardwareProtocolAdapter implements HardwareProtocolAdapter {
  readonly name: ProtocolAdapterName = "mqtt";

  async dispatch(
    _input: DispatchDeviceCommandInput,
    context: AdapterDispatchContext,
  ): Promise<HardwareDispatchResult> {
    return context.safeFallback(
      "MQTT protocol adapter is running in stub mode; no hardware command was sent",
    );
  }
}

class ModbusHardwareProtocolAdapter implements HardwareProtocolAdapter {
  readonly name: ProtocolAdapterName = "modbus";

  async dispatch(
    _input: DispatchDeviceCommandInput,
    context: AdapterDispatchContext,
  ): Promise<HardwareDispatchResult> {
    return context.safeFallback(
      "Modbus protocol adapter is running in stub mode; no hardware command was sent",
    );
  }
}

class HardwareGatewayService {
  private readonly baseUrl = (process.env.HARDWARE_GATEWAY_URL ?? "").trim();
  private readonly apiKey = (process.env.HARDWARE_GATEWAY_API_KEY ?? "").trim();
  private readonly dryRun = process.env.HARDWARE_GATEWAY_DRY_RUN === "true";
  private readonly strictMode = process.env.HARDWARE_GATEWAY_STRICT_MODE === "true";
  private readonly protocolAdapter = (
    process.env.HARDWARE_PROTOCOL_ADAPTER ?? DEFAULT_PROTOCOL_ADAPTER
  )
    .trim()
    .toLowerCase();
  private readonly timeoutMs = Number.parseInt(
    process.env.HARDWARE_GATEWAY_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`,
    10,
  );
  private readonly maxHistorySize = Number.parseInt(
    process.env.HARDWARE_GATEWAY_HISTORY_SIZE ?? `${DEFAULT_DISPATCH_HISTORY_SIZE}`,
    10,
  );
  private readonly adapters: Record<ProtocolAdapterName, HardwareProtocolAdapter>;
  private readonly dispatchHistory: HardwareDispatchHistoryEntry[] = [];
  private nextHistoryId = 1;
  private totalDispatches = 0;
  private successfulDispatches = 0;
  private failedDispatches = 0;
  private dispatchedCommands = 0;
  private fallbackDispatches = 0;
  private lastFailureReason: string | null = null;

  constructor() {
    this.adapters = {
      http: new HttpHardwareProtocolAdapter(
        this.baseUrl,
        this.apiKey,
        this.timeoutMs,
      ),
      mqtt: new MqttHardwareProtocolAdapter(),
      modbus: new ModbusHardwareProtocolAdapter(),
    };
  }

  async dispatchDeviceCommand(
    input: DispatchDeviceCommandInput,
  ): Promise<HardwareDispatchResult> {
    const startedAt = Date.now();
    const adapter = this.resolveAdapter(this.protocolAdapter);

    let result: HardwareDispatchResult;
    if (this.dryRun) {
      console.log("[HardwareGateway] Dry-run command:", {
        deviceId: input.deviceId,
        status: input.status,
        requestedBy: input.requestedBy,
      });
      result = this.safeFallback("Hardware gateway dry-run mode enabled");
      this.recordDispatchResult(input, startedAt, adapter, result);
      return result;
    }

    if (!adapter) {
      result = this.safeFallback(
        `Unknown hardware protocol adapter "${this.protocolAdapter}", falling back to safe mode`,
      );
      this.recordDispatchResult(input, startedAt, null, result);
      return result;
    }

    result = await adapter.dispatch(input, {
      strictMode: this.strictMode,
      safeFallback: this.safeFallback.bind(this),
    });
    this.recordDispatchResult(input, startedAt, adapter, result);
    return result;
  }

  getDispatchHistory(limit: number = this.maxHistorySize): HardwareDispatchHistoryEntry[] {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(Math.trunc(limit), this.maxHistorySize))
      : this.maxHistorySize;
    return this.dispatchHistory.slice(-normalizedLimit).reverse();
  }

  getHealthInfo(): HardwareGatewayHealthInfo {
    const resolvedAdapter = this.resolveAdapter(this.protocolAdapter)?.name ?? null;
    const latestTimestamp =
      this.dispatchHistory.length > 0
        ? this.dispatchHistory[this.dispatchHistory.length - 1]?.timestamp ?? null
        : null;
    const status: HardwareGatewayHealthInfo["status"] =
      this.dryRun || !resolvedAdapter || this.failedDispatches > 0
        ? "degraded"
        : "healthy";

    return {
      status,
      config: {
        dryRun: this.dryRun,
        strictMode: this.strictMode,
        timeoutMs: this.timeoutMs,
        adapterRequested: this.protocolAdapter,
        adapterResolved: resolvedAdapter,
        baseUrlConfigured: this.baseUrl.length > 0,
        apiKeyConfigured: this.apiKey.length > 0,
      },
      counters: {
        totalDispatches: this.totalDispatches,
        successfulDispatches: this.successfulDispatches,
        failedDispatches: this.failedDispatches,
        dispatchedCommands: this.dispatchedCommands,
        fallbackDispatches: this.fallbackDispatches,
      },
      history: {
        size: this.dispatchHistory.length,
        maxSize: this.maxHistorySize,
        latestTimestamp,
      },
      lastFailureReason: this.lastFailureReason,
    };
  }

  private safeFallback(reason: string, statusCode?: number): HardwareDispatchResult {
    return {
      success: true,
      commandDispatched: false,
      fallbackUsed: true,
      reason,
      statusCode,
    };
  }

  private resolveAdapter(
    adapterName: string,
  ): HardwareProtocolAdapter | undefined {
    return this.adapters[adapterName as ProtocolAdapterName];
  }

  private recordDispatchResult(
    input: DispatchDeviceCommandInput,
    startedAt: number,
    adapter: HardwareProtocolAdapter | null | undefined,
    result: HardwareDispatchResult,
  ): void {
    const durationMs = Math.max(0, Date.now() - startedAt);
    this.totalDispatches += 1;

    if (result.success) {
      this.successfulDispatches += 1;
    } else {
      this.failedDispatches += 1;
      this.lastFailureReason = result.reason ?? "Unknown failure";
    }

    if (result.commandDispatched) {
      this.dispatchedCommands += 1;
    }
    if (result.fallbackUsed) {
      this.fallbackDispatches += 1;
    }

    const entry: HardwareDispatchHistoryEntry = {
      id: this.nextHistoryId++,
      timestamp: new Date().toISOString(),
      durationMs,
      adapterRequested: this.protocolAdapter,
      adapterResolved: adapter?.name ?? null,
      input: { ...input },
      result: { ...result },
    };

    this.dispatchHistory.push(entry);
    const maxSize = Number.isFinite(this.maxHistorySize)
      ? Math.max(1, this.maxHistorySize)
      : DEFAULT_DISPATCH_HISTORY_SIZE;
    if (this.dispatchHistory.length > maxSize) {
      this.dispatchHistory.splice(0, this.dispatchHistory.length - maxSize);
    }
  }
}

export const hardwareGatewayService = new HardwareGatewayService();
