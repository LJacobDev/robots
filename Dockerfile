# ---- Build stage ----
FROM node:24-slim AS build

WORKDIR /app

# Install dependencies first (layer caching — only re-runs when package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build the Vue client
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:24-slim

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server code, data files, and built client
COPY server/ server/
COPY data/ data/
COPY --from=build /app/dist/ dist/

# Create writable directory for the SQLite database
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/server.js"]
