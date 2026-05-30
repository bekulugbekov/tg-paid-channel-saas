# ─── Stage 1: Build React dashboard ─────────────────────────────────────────
FROM node:20-alpine AS dashboard-build
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ .
RUN npm run build

# ─── Stage 2: Build backend ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma/ ./prisma/
RUN npm ci
RUN npx prisma generate
COPY src/ ./src/
RUN npm run build

# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma/ ./prisma/

# Install production deps + prisma CLI (needed for `prisma migrate deploy`)
RUN npm ci --omit=dev && \
    npm install --no-save prisma@5

# Copy Prisma generated client (platform-specific binary from builder)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled backend
COPY --from=builder /app/dist ./dist/

# Copy built dashboard
COPY --from=dashboard-build /app/dashboard/dist ./dashboard/dist/

# Entrypoint: run migrations then start app
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
