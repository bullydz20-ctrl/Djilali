FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
COPY server ./server

RUN npm run build && npm prune --omit=dev

RUN mkdir -p /data/uploads

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV CP4_DB_PATH=/data/cp4_arena.db
ENV CP4_UPLOADS_DIR=/data/uploads

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["npm", "start"]
