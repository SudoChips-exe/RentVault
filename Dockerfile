# Combined deployment for a single free Render Web Service: the Vite
# marketing/tenant frontend, the Next.js dashboards portal, and the backend
# API (formerly Firebase Cloud Functions) all run from one Node process
# (backend/server). Firestore/Auth/Storage stay on Firebase - only this
# compute layer moved off Cloud Functions, since that requires the paid
# Blaze plan.
#
# Using npm (not bun) for the install step here - bun's hardlink/copyfile
# extraction proved unreliable in containerized Linux builds (intermittent
# corrupted/incomplete package extraction for firebase, lucide-react, etc.,
# reproduced both locally and on Render). npm is slower but far more
# battle-tested for this. bun.lock isn't consumed here, so versions resolve
# from package.json ranges rather than being frozen - acceptable for now.

# Firebase web client config - not secret (Firebase protects access via
# security rules and auth domain restrictions, not by hiding these values;
# see https://firebase.google.com/docs/projects/api-keys). Baked in here
# because dashboards' Next.js prerenders pages at build time, which runs the
# Firebase client SDK init even for 'use client' pages, and fails without
# these; frontend needs them too so the deployed app actually works at
# runtime, not just builds.
ARG FIREBASE_API_KEY=AIzaSyAd7j4e-1F57HFQQxFsA5dQ3avoxXC09Wo
ARG FIREBASE_AUTH_DOMAIN=rentvault-sudochips.firebaseapp.com
ARG FIREBASE_PROJECT_ID=rentvault-sudochips
ARG FIREBASE_STORAGE_BUCKET=rentvault-sudochips.firebasestorage.app
ARG FIREBASE_MESSAGING_SENDER_ID=479739408676
ARG FIREBASE_APP_ID=1:479739408676:web:e3c32072d89731c7b3c3b1

FROM node:20-alpine AS frontend-build
ARG FIREBASE_API_KEY
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG FIREBASE_MESSAGING_SENDER_ID
ARG FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$FIREBASE_APP_ID
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS dashboards-build
ARG FIREBASE_API_KEY
ARG FIREBASE_AUTH_DOMAIN
ARG FIREBASE_PROJECT_ID
ARG FIREBASE_STORAGE_BUCKET
ARG FIREBASE_MESSAGING_SENDER_ID
ARG FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$FIREBASE_APP_ID
WORKDIR /app/dashboards
COPY dashboards/package.json ./
RUN npm install
COPY dashboards/ ./
ENV NEXT_BASE_PATH=/dashboard
RUN npm run build

FROM node:20-alpine AS server-build
WORKDIR /app/backend/server
COPY backend/server/package.json ./
RUN npm install
COPY backend/server/ ./
RUN npm run build

# --- Runtime ---------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

# Frontend: static build output only.
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Dashboards: Next.js needs its production build output, public assets, and
# full node_modules (this app isn't built with `output: standalone`).
COPY --from=dashboards-build /app/dashboards/.next ./dashboards/.next
COPY --from=dashboards-build /app/dashboards/public ./dashboards/public
COPY --from=dashboards-build /app/dashboards/package.json ./dashboards/package.json
COPY --from=dashboards-build /app/dashboards/node_modules ./dashboards/node_modules
COPY --from=dashboards-build /app/dashboards/next.config.ts ./dashboards/next.config.ts

# Backend server: compiled JS + its own node_modules (includes next/react,
# used to embed the dashboards app programmatically).
COPY --from=server-build /app/backend/server/dist ./backend/server/dist
COPY --from=server-build /app/backend/server/package.json ./backend/server/package.json
COPY --from=server-build /app/backend/server/node_modules ./backend/server/node_modules

ENV NODE_ENV=production
# next.config.ts is re-evaluated at runtime when backend/server embeds this
# app programmatically, so NEXT_BASE_PATH must also be set here (not just
# during `next build`) or the runtime config falls out of sync with the
# basePath that was actually baked into the build.
ENV NEXT_BASE_PATH=/dashboard
EXPOSE 3001
CMD ["node", "backend/server/dist/index.js"]
