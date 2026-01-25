# Use Node.js 22 LTS as base image
FROM node:22-alpine AS base

# Install pnpm globally (available in all stages)
RUN npm install -g pnpm

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments
ARG ASTRO_DB_REMOTE_URL
ARG ASTRO_DB_APP_TOKEN
ARG OPENROUTER_API_KEY
ARG ADMIN_USER
ARG ADMIN_PASSWORD

# Set environment variables for build
ENV ASTRO_DB_REMOTE_URL=${ASTRO_DB_REMOTE_URL#=}
ENV ASTRO_DB_APP_TOKEN=${ASTRO_DB_APP_TOKEN}
ENV OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
ENV ADMIN_USER=${ADMIN_USER}
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Build the application
RUN pnpm run build --remote

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Runtime arguments/envs
ARG ASTRO_DB_REMOTE_URL
ARG ASTRO_DB_APP_TOKEN=unused
ARG OPENROUTER_API_KEY
ARG ADMIN_USER
ARG ADMIN_PASSWORD

ENV ASTRO_DB_REMOTE_URL=${ASTRO_DB_REMOTE_URL#=}
ENV ASTRO_DB_APP_TOKEN=${ASTRO_DB_APP_TOKEN}
ENV OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
ENV ADMIN_USER=${ADMIN_USER}
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 astro

# Copy the built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Create data directory for persistent database
RUN mkdir -p /app/data && chown astro:nodejs /app/data

# Set permissions
USER astro

# Expose port
EXPOSE 4321

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node --eval "require('http').get('http://localhost:4321', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["pnpm", "run", "preview"]
