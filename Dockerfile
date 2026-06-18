# Multi-stage build process for optimal production performance and low footprint
FROM node:20-alpine AS builder
WORKDIR /app

# Firebase env vars needed at Vite build time (VITE_ prefix exposes to frontend bundle)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_DATABASE_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_DATABASE_ID=$VITE_FIREBASE_DATABASE_ID

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime runner environment
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/firebase-applet-config.example.json ./firebase-applet-config.example.json
RUN mkdir -p data

# Expose the mandatory port 3000
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start compiled CommonJS server bundle
CMD ["node", "dist/server.cjs"]
