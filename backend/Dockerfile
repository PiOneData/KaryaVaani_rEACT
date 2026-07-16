FROM node:20-alpine
# ffmpeg: transcode synthesized WAV voice notes to OGG/Opus, the format
# WhatsApp requires for audio messages (WAV is rejected by the API).
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN node scripts/seed.js || true
EXPOSE 3241
ENV PORT=3241
CMD ["node", "server.js"]
