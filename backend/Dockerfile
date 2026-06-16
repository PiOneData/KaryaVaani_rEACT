FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN node scripts/seed.js || true
EXPOSE 3241
ENV PORT=3241
CMD ["node", "server.js"]
