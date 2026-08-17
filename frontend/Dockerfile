FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npm run build


FROM nginx:1.27-alpine

COPY docker/default.conf.template /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 10000

CMD ["sh", "-c", "echo 'Waiting for LifeOS backend...'; until wget -q -O /dev/null 'https://lifeos-api-eh4l.onrender.com/health'; do echo 'Backend is waking up; retrying...'; sleep 3; done; echo 'Starting LifeOS frontend...'; exec nginx -g 'daemon off;'"]
