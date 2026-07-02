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

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS dashboards-build
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
