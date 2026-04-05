# Stage 1: Build
FROM node:20-alpine AS builder

# Required for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

RUN apk add --no-cache sqlite

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/build ./build

ENV DATABASE_PATH=/app/data/sctracker.db
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Ensure data directory exists
RUN mkdir -p /app/data

CMD ["node", "build/index.js"]
