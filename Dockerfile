FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY client/package*.json ./client/
RUN npm --prefix client install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/db ./db
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 8080
CMD ["npm", "start"]
