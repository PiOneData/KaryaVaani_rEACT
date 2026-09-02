# Stage 1: build Vite/React app
FROM node:20-alpine AS builder
WORKDIR /app
# Tenant identity is baked in here: Vite inlines VITE_* at BUILD time, so a
# container branded for a different customer is a rebuild, not a restart.
# Leave them unset and the UI names no client (see src/config/tenant.js).
ARG VITE_TENANT_NAME
ARG VITE_TENANT_SITE
ARG VITE_TENANT_REGION
ARG VITE_TENANT_REGION_FULL
ARG VITE_TENANT_LEGAL_NAME
ARG VITE_TENANT_ZONE
ARG VITE_TENANT_ADDRESS
ARG VITE_TENANT_LOCATION_CODE
ARG VITE_TENANT_HQ
ARG VITE_TENANT_COMPLIANCE_EMAIL
ARG VITE_TENANT_HELPDESK_PHONE
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: serve with nginx on port 3240
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3240
CMD ["nginx", "-g", "daemon off;"]
