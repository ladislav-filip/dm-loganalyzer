# Production multi-stage Dockerfile for a Node + TypeScript app
# Adjust Node version if you need a newer/older runtime.
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Install deps (use package-lock.json if present for reproducible installs)
COPY package*.json ./
RUN npm ci

# Copy TypeScript config and source
COPY tsconfig*.json ./
COPY src ./src

# Build the TypeScript code into /app/dist
RUN npm run build

# ---- Runtime image ----
FROM node:18-alpine AS runner
WORKDIR /app

# Copy only production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Non-root user for better security
USER node

# Replace dist/index.js with your real entry if different (e.g. dist/main.js)
CMD ["node", "dist/index.js"]
