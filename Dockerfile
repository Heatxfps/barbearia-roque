# ---------- 1) monta o app (PWA) ----------
FROM node:24-alpine AS app
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---------- 2) servidor (API + app) ----------
FROM node:24-alpine
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo \
    NODE_ENV=production \
    PASTA_APP=/srv/dist \
    BANCO=/dados/roque.db \
    PORTA=3333
WORKDIR /srv/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=app /app/dist /srv/dist
VOLUME /dados
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3333/api/saude || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.ts"]
