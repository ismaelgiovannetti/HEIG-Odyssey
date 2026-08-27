FROM node:22-alpine AS base

# 1. Installation reproductible des dépendances
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# 2. Construction de l'application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
# Ces valeurs sont factices, limitées au build et absentes du conteneur final.
# Les vraies valeurs sont injectées uniquement au démarrage du conteneur.
RUN BETTER_AUTH_SECRET=build-only-auth-secret-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3000 \
    npm run build

# 3. Image de production minimale
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
