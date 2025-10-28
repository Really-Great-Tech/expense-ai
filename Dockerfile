# Build stage
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies required for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci

COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build
# Production stage
FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Install system dependencies including Python and build tools for native modules
RUN apk add --no-cache \
    curl=8.14.1-r2 \
    python3 \
    make \
    g++

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

# Copy the expense schema file needed at runtime
COPY expense_file_schema.json ./

# Copy country seed data for migrations
COPY country_seed ./country_seed

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy SSL certificates for RDS IAM authentication
# This includes the global-bundle.pem for secure Aurora connections
COPY certs ./certs

# Create uploads directory with proper permissions
RUN mkdir -p uploads && chmod 755 uploads

# Add non-root user
RUN addgroup -g 1001 nodejs && \
  adduser -S -u 1001 -G nodejs nodejs

# Change ownership of app directory to nodejs user
RUN chown -R nodejs:nodejs /usr/src/app

USER nodejs

# Add these environment variables to prevent Husky installation
ENV HUSKY=0
ENV CI=true

EXPOSE 3000
EXPOSE 9229

# Health check instruction
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health-check || exit 1

# Use entrypoint script for flexible migration control
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/main"]