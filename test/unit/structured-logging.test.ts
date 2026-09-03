import { describe, it, expect } from "vitest";
import {
  logger,
  sanitizeLogData,
  createStructuredLog,
  getRequestId,
} from "@/lib/logger";

describe("Structured Logging & Secret Redaction (T-US20-06)", () => {
  it("génère une structure JSON valide avec timestamp, niveau et message", () => {
    const entry = logger.info("Combat d'entraînement démarré", {
      action: "battle.start",
      difficulty: "hard",
    });

    expect(entry).toHaveProperty("timestamp");
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("Combat d'entraînement démarré");
    expect(entry.data?.action).toBe("battle.start");
    expect(entry.data?.difficulty).toBe("hard");
  });

  it("corrèle correctement les événements avec requestId et eventId", () => {
    const entry = logger.info("Événement Outbox publié dans Redis", {
      requestId: "req_abc123",
      eventId: "evt_998877",
      userId: "usr_42",
      stream: "heig-odyssey:events",
    });

    expect(entry.requestId).toBe("req_abc123");
    expect(entry.eventId).toBe("evt_998877");
    expect(entry.userId).toBe("usr_42");
    expect(entry.data?.stream).toBe("heig-odyssey:events");
    // requestId et eventId ne doivent pas être dupliqués dans data
    expect(entry.data?.requestId).toBeUndefined();
    expect(entry.data?.eventId).toBeUndefined();
  });

  it("reprend uniquement un requestId amont sûr", () => {
    const forwarded = new Request("http://localhost/api/health", {
      headers: { "x-request-id": "req_proxy-123" },
    });
    const invalid = new Request("http://localhost/api/health", {
      headers: { "x-request-id": "identifiant avec espaces" },
    });

    expect(getRequestId(forwarded)).toBe("req_proxy-123");
    expect(getRequestId(invalid)).toMatch(/^req_[0-9a-f-]{36}$/);
  });

  describe("Filtrage et masquage des secrets (Redaction)", () => {
    it("masque automatiquement les mots de passe, tokens et clés d'API", () => {
      const sensitiveContext = {
        username: "joueur_test",
        password: "SuperSecretPassword123!",
        confirmPassword: "SuperSecretPassword123!",
        token: "jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        sessionToken: "session_token_value",
        apiKey: "re_test_key_12345",
        resend_api_key: "re_secret_live",
      };

      const sanitized = sanitizeLogData(sensitiveContext) as Record<
        string,
        unknown
      >;

      expect(sanitized.username).toBe("joueur_test");
      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.confirmPassword).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.sessionToken).toBe("[REDACTED]");
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.resend_api_key).toBe("[REDACTED]");
    });

    it("masque les tokens Bearer et chaînes de connexion PostgreSQL dans les strings", () => {
      const headerString = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
      const dbUrlString =
        "postgresql://postgres:mysecretpassword@localhost:5432/heig_odyssey";
      const redisUrlString = "redis://worker:redispassword@redis:6379";

      const sanitizedHeader = sanitizeLogData(headerString);
      const sanitizedDbUrl = sanitizeLogData(dbUrlString);
      const sanitizedRedisUrl = sanitizeLogData(redisUrlString);

      expect(sanitizedHeader).toBe("Bearer [REDACTED]");
      expect(sanitizedDbUrl).toBe(
        "postgresql://postgres:[REDACTED]@localhost:5432/heig_odyssey",
      );
      expect(sanitizedRedisUrl).toBe("redis://worker:[REDACTED]@redis:6379");
    });

    it("masque récursivement les objets imbriqués sans altérer les autres données", () => {
      const nested = {
        user: {
          id: "usr_1",
          email: "test@example.com",
          credentials: {
            passwordHash: "bcrypt_hash_123456",
            recoveryToken: "rec_token_789",
          },
        },
        payload: {
          speciesId: "garchomp",
          level: 50,
        },
      };

      const sanitized = sanitizeLogData(nested);

      expect(sanitized).toEqual({
        user: {
          id: "usr_1",
          email: "test@example.com",
          credentials: {
            passwordHash: "[REDACTED]",
            recoveryToken: "[REDACTED]",
          },
        },
        payload: {
          speciesId: "garchomp",
          level: 50,
        },
      });
    });
  });

  describe("Capture des erreurs", () => {
    it("inclut le nom et le message de l'erreur de façon structurée", () => {
      const testError = new Error("Connexion Redis interrompue");
      testError.name = "RedisConnectionError";

      const log = createStructuredLog(
        "error",
        "Échec d'envoi",
        { requestId: "req_err" },
        testError,
      );

      expect(log.level).toBe("error");
      expect(log.error).toBeDefined();
      expect(log.error?.name).toBe("RedisConnectionError");
      expect(log.error?.message).toBe("Connexion Redis interrompue");
    });

    it("masque les secrets contenus dans le message et la stack d'une erreur", () => {
      const error = new Error(
        "Connexion refusée pour postgresql://admin:super-secret@db:5432/app",
      );
      error.stack = "Authorization: Bearer abc.def.ghi";

      const log = createStructuredLog("error", "Échec", undefined, error);
      const serialized = JSON.stringify(log);

      expect(serialized).not.toContain("super-secret");
      expect(serialized).not.toContain("abc.def.ghi");
      expect(log.error?.message).toContain("[REDACTED]");
    });
  });
});
