FROM node:22-alpine AS builder
WORKDIR /usr/src/app
RUN apk add --no-cache python3 make g++
COPY package*.json tsconfig*.json nest-cli.json ./
RUN npm ci
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM node:22-alpine
WORKDIR /usr/src/app
RUN apk add --no-cache curl ca-certificates && adduser -S -u 1001 nodejs
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /usr/src/app/dist ./dist
COPY expense_file_schema.json country_seed ./
RUN mkdir -p certs && curl -so certs/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem && chown -R nodejs /usr/src/app
USER nodejs
ENV NODE_ENV=production HUSKY=0 CI=true
EXPOSE 3000
CMD ["node", "dist/main"]
