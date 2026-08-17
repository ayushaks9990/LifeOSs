FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build


FROM nginx:1.27-alpine

ENV PORT=10000 \
    BACKEND_HOST=api \
    BACKEND_PORT=10000

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 10000

CMD ["sh", "-c", "echo 'Waiting for LifeOS backend...'; until wget -q -O /dev/null \"http://${BACKEND_HOST}:${BACKEND_PORT}/health\"; do echo 'Backend is not ready; retrying in 3 seconds...'; sleep 3; done; echo 'Backend is healthy. Starting frontend...'; exec nginx -g 'daemon off;'"]
