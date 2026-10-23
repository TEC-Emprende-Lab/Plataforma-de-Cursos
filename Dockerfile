# Etapa 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar código y build
COPY . .

# Variables VITE_* se pasan en build time
ARG VITE_CERT_API_URL
ARG VITE_STORAGE_MODE
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_DIAGNOSTICO_API_URL

ENV VITE_CERT_API_URL=$VITE_CERT_API_URL \
    VITE_STORAGE_MODE=$VITE_STORAGE_MODE \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_DIAGNOSTICO_API_URL=$VITE_DIAGNOSTICO_API_URL

RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
