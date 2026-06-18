# Multi-stage build process for optimal production performance and low footprint
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Use real firebase config if present; fall back to example so build succeeds without it
RUN [ -f firebase-applet-config.json ] || cp firebase-applet-config.example.json firebase-applet-config.json
RUN npm run build

# Stage 2: Runtime runner environment
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/firebase-applet-config.example.json ./firebase-applet-config.example.json
RUN mkdir -p data

# Expose the mandatory port 3000
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start compiled CommonJS server bundle
CMD ["node", "dist/server.cjs"]
