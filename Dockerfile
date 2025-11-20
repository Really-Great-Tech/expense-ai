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
COPY tsconfig*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Install TypeORM CLI dependencies needed for migration commands
# These are required for 'npx typeorm migration:run' to work
RUN npm install --save-dev typeorm ts-node @types/node

COPY --from=builder /usr/src/app/dist ./dist

# Copy the expense schema file needed at runtime
COPY expense_file_schema.json ./

# Copy country seed data for migrations
COPY country_seed ./country_seed

# Copy template directory structure (will be preserved unless volume-mounted)
COPY .docker-template/uploads ./uploads
COPY .docker-template/splits ./splits
COPY .docker-template/receipts ./receipts
COPY .docker-template/validation_results ./validation_results
COPY .docker-template/markdown_extractions ./markdown_extractions

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy SSL certificates for RDS IAM authentication
# This includes the global-bundle.pem for secure Aurora connections
COPY certs ./certs

# Add non-root user with configurable UID/GID for Linux compatibility
# Build arg allows matching host user: docker build --build-arg USER_UID=$(id -u) --build-arg USER_GID=$(id -g)
ARG USER_UID=1001
ARG USER_GID=1001

RUN addgroup -g ${USER_GID} nodejs && \
  adduser -S -u ${USER_UID} -G nodejs nodejs

# Set proper permissions on all directories (already copied from template)
RUN chmod -R 755 uploads splits receipts validation_results markdown_extractions

# Change ownership of app directory to nodejs user (including all directories)
RUN chown -R nodejs:nodejs /usr/src/app

USER nodejs

# Add these environment variables to prevent Husky installation
ENV HUSKY=0
ENV CI=true

EXPOSE 3000
EXPOSE 9229


# Migrations run automatically via TypeORM's migrationsRun: true config
# No need for entrypoint script - TypeORM handles migrations on app startup
# Clear any inherited ENTRYPOINT from base image
ENTRYPOINT []
CMD ["node", "dist/main"]
