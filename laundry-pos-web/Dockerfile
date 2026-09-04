# Build Stage
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build --configuration=production

# Run Stage (using NGINX to serve the POS)
FROM nginx:alpine
COPY --from=build /app/dist/laundry-pos-web/browser /usr/share/nginx/html
EXPOSE 80