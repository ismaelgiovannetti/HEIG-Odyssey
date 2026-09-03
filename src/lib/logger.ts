import "server-only";

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

const REQUEST_ID_HEADER = "x-request-id";
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

// Clés sensibles à masquer automatiquement dans les logs
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
 * Masque récursivement les données sensibles pour éviter toute fuite de secret.
 */
export function sanitizeLogData(obj: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    // Détection de patterns sensibles dans les chaînes
    if (/bearer\s+[a-zA-Z0-9._~+\/-]+=*/i.test(obj)) {
      return obj.replace(
        /bearer\s+[a-zA-Z0-9._~+\/-]+=*/gi,
        "Bearer [REDACTED]",
      );
    }
    if (/[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:[^@\s]+@/i.test(obj)) {
      return obj.replace(
        /([a-z][a-z0-9+.-]*:\/\/)([^:\s/@]+):([^@\s]+)@/gi,
        "$1$2:[REDACTED]@",
      );
    }
    return obj.replace(
      /\b(password|secret|token|api[_-]?key|authorization)\s*[=:]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    );
  }

  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token")
    ) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    }
  }

  return sanitized;
}

function sanitizeText(value: string): string {
  return String(sanitizeLogData(value));
}

/** Réutilise un identifiant amont sûr ou crée la corrélation de la requête. */
export function getRequestId(request?: Pick<Request, "headers">): string {
  const forwarded = request?.headers.get(REQUEST_ID_HEADER)?.trim();
  return forwarded && SAFE_CORRELATION_ID.test(forwarded)
    ? forwarded
    : `req_${randomUUID()}`;
}

/**
 * Formate et émet un log structuré JSON corrélable.
 */
export function createStructuredLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  err?: unknown,
): StructuredLogEntry {
  const sanitizedContext = context
    ? (sanitizeLogData(context) as Record<string, unknown>)
    : undefined;

  const { requestId, eventId, userId, ...remainingData } = (sanitizedContext ||
    {}) as LogContext;

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
      name: sanitizeText(err.name),
      message: sanitizeText(err.message),
      ...(process.env.NODE_ENV !== "production" && err.stack
        ? { stack: sanitizeText(err.stack) }
        : {}),
    };
  } else if (err !== undefined) {
    entry.error = {
      name: "UnknownError",
      message: sanitizeText(String(err)),
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

  generateEventId(): string {
    return `evt_${randomUUID()}`;
  },
};
