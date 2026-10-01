FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_URL=file:/data/app.db
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
CMD ["npm", "start"]
