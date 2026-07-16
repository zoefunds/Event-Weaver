FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 8080
USER node
CMD ["node", "src/server.js"]
