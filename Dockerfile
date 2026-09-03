FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base

# 1. Installation reproductible des dépendances
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# 2. Construction de l'application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Ces valeurs sont factices, limitées au build et absentes du conteneur final.
# Les vraies valeurs sont injectées uniquement au démarrage du conteneur.
RUN BETTER_AUTH_SECRET=build-only-auth-secret-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3000 \
    npm run build

# 3. Image dédiée aux migrations de production
# Cette cible conserve Prisma sans alourdir le conteneur applicatif exposé.
FROM deps AS migrator
WORKDIR /app

ENV NODE_ENV=production

# L'utilisateur Node peut lire les migrations mais ne peut pas modifier l'image.
USER node

ENTRYPOINT ["./node_modules/.bin/prisma"]
CMD ["migrate", "deploy"]

# 4. Construction du worker autonome
FROM deps AS worker-builder
WORKDIR /app

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY scripts/ops/worker-healthcheck.mjs ./scripts/ops/worker-healthcheck.mjs

# Les modules internes sont regroupés dans un seul fichier ESM ; seuls les
# paquets npm restent externes. Les dépendances de développement sont ensuite
# retirées sans rejouer les scripts d'installation.
RUN ./node_modules/.bin/esbuild src/worker/index.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=esm \
    --packages=external \
    --alias:server-only=./src/worker/server-only-shim.ts \
    --tsconfig=tsconfig.json \
    --outfile=dist/worker.mjs \
    && npm prune --omit=dev --ignore-scripts

# 5. Image minimale dédiée au worker de quêtes
FROM base AS worker
WORKDIR /app

ENV NODE_ENV=production

COPY --from=worker-builder --chown=node:node /app/node_modules ./node_modules
# Prisma génère ce client pendant `npm ci`; cette copie explicite le préserve
# même si npm prune retire les dossiers générés non déclarés.
COPY --from=deps --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=worker-builder --chown=node:node /app/dist/worker.mjs ./worker.mjs
COPY --from=worker-builder --chown=node:node /app/scripts/ops/worker-healthcheck.mjs ./scripts/ops/worker-healthcheck.mjs

# Le worker n'a besoin d'aucun port et s'exécute sans privilèges root.
USER node

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD ["node", "scripts/ops/worker-healthcheck.mjs"]

CMD ["node", "--conditions=react-server", "worker.mjs"]

# 6. Image de production minimale
# Cette cible reste la dernière afin que `docker build .` continue de produire
# l'application web lorsque le target n'est pas précisé.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Le processus applicatif ne s'exécute jamais avec les droits root.
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
