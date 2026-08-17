FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

RUN npm run build


FROM nginx:1.27-alpine
ENV PORT=10000 \
    BACKEND_HOST=api

COPY docker/default.conf.template /etc/nginx/templates/default.conf.template

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 10000

CMD ["sh", "-c", "echo \"Waiting for https://${BACKEND_HOST}.onrender.com/health\"; until wget -q -O /dev/null \"https://${BACKEND_HOST}.onrender.com/health\"; do echo 'Backend is not ready; retrying in 3 seconds...'; sleep 3; done; echo 'Backend is healthy. Starting frontend...'; exec nginx -g 'daemon off;'"]
