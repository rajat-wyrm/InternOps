FROM node:18-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY backend/ .
COPY backend/.env .env

EXPOSE 5000
CMD ["node", "src/app.js"]