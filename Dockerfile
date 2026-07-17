# Two deployable targets from one build:
#   web  — slim Next.js standalone runtime (Cloud Run service)
#   jobs — full workspace with the Prisma CLI, seed script, and data/ CSVs
#          (Cloud Run Job: migrate deploy + seed)
# Both run on bun: the Prisma client is generated with runtime = "bun".
# oven/bun is Debian-based, so the Prisma CLI's downloaded schema-engine
# binary (needed only in `jobs`) links fine.

FROM oven/bun:1.3.13 AS build
WORKDIR /app

# Install with only the manifests present so the layer caches across
# source-only changes.
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contract/package.json packages/contract/package.json
COPY packages/database/package.json packages/database/package.json
RUN bun install --frozen-lockfile

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM build AS jobs
CMD ["sh", "-c", "bun run db:migrate && bun run db:seed"]

FROM oven/bun:1.3.13-slim AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Standalone output is traced from the monorepo root (outputFileTracingRoot),
# so the server entry sits at apps/web/server.js inside it. .next/static is
# not copied into standalone by default (this app has no public/ directory).
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["bun", "apps/web/server.js"]
