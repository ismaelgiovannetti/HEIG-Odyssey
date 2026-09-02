import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  eventId?: string;
  userId?: string;
  action?: string;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  eventId?: string;
  userId?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Clés sensibles à masquer automatiquement dans les logs (T-US20-06)
const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "secret",
  "token",
  "authorization",
  "auth",
  "bearer",
  "cookie",
  "sessionid",
  "sessiontoken",
  "apikey",
  "api_key",
  "resend_api_key",
  "database_url",
  "better_auth_secret",
  "cr_pat",
  "ssh_key",
]);

/**
 * Masque récursivement les données sensibles pour éviter toute fuite de secret (T-US20-06).
 */
export function sanitizeLogData(obj: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Détection de patterns sensibles dans les chaînes
    if (/bearer\s+[a-zA-Z0-9_\-\.]+/i.test(obj)) {
      return obj.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");
    }
    if (/postgres(ql)?:\/\/[^:]+:[^@]+@/i.test(obj)) {
      return obj.replace(/postgres(ql)?:\/\/([^:]+):([^@]+)@/gi, "postgresql://$2:[REDACTED]@");
    }
    return obj;
  }

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret") || lowerKey.includes("token")) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    }
  }

  return sanitized;
}

/**
 * Formate et émet un log structuré JSON corrélable (T-US20-06).
 */
export function createStructuredLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  err?: unknown
): StructuredLogEntry {
  const sanitizedContext = context ? (sanitizeLogData(context) as Record<string, unknown>) : undefined;

  const { requestId, eventId, userId, ...remainingData } = (sanitizedContext || {}) as LogContext;

  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(requestId ? { requestId: String(requestId) } : {}),
    ...(eventId ? { eventId: String(eventId) } : {}),
    ...(userId ? { userId: String(userId) } : {}),
    ...(Object.keys(remainingData).length > 0 ? { data: remainingData } : {}),
  };

  if (err instanceof Error) {
    entry.error = {
      name: err.name,
      message: err.message,
      ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
    };
  }

  return entry;
}

/**
 * Logger principal de l'application HEIG-Odyssey.
 */
export const logger = {
  debug(message: string, context?: LogContext) {
    const entry = createStructuredLog("debug", message, context);
    if (process.env.NODE_ENV !== "test") console.debug(JSON.stringify(entry));
    return entry;
  },

  info(message: string, context?: LogContext) {
    const entry = createStructuredLog("info", message, context);
    if (process.env.NODE_ENV !== "test") console.info(JSON.stringify(entry));
    return entry;
  },

  warn(message: string, context?: LogContext, err?: unknown) {
    const entry = createStructuredLog("warn", message, context, err);
    if (process.env.NODE_ENV !== "test") console.warn(JSON.stringify(entry));
    return entry;
  },

  error(message: string, context?: LogContext, err?: unknown) {
    const entry = createStructuredLog("error", message, context, err);
    if (process.env.NODE_ENV !== "test") console.error(JSON.stringify(entry));
    return entry;
  },

  generateRequestId(): string {
    return `req_${randomUUID()}`;
  },
};
