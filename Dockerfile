FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

ENV PORT=3000

CMD ["sh", "-c", "cat > /app/dist/env.js <<EOF\nwindow.__APP_CONFIG__ = {\n  VITE_API_BASE_URL: \"${VITE_API_BASE_URL:-}\",\n  VITE_SUPABASE_URL: \"${VITE_SUPABASE_URL:-}\",\n  VITE_SUPABASE_ANON_KEY: \"${VITE_SUPABASE_ANON_KEY:-}\"\n};\nEOF\nserve -s dist -l tcp://0.0.0.0:${PORT}"]
