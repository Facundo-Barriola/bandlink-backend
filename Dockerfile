# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build   # genera dist/

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
