-- Ajoute le nom d'utilisateur normalisé utilisé par le plugin Username.
ALTER TABLE "user" ADD COLUMN "username" TEXT;

-- Better Auth 1.7 identifie un compte externe par issuer et accountId.
ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

-- Complète les comptes existants avant de rendre la colonne obligatoire.
UPDATE "account"
SET "issuer" = CASE
    WHEN "providerId" = 'credential' THEN 'local:credential'
    ELSE 'local:oauth:' || "providerId"
END
WHERE "issuer" IS NULL;

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;

CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
CREATE INDEX "session_userId_idx" ON "session"("userId");
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");
CREATE INDEX "account_userId_idx" ON "account"("userId");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
