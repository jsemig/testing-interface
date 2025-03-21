FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Using production mode for the build
ENV NODE_ENV=production
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add debugging to see what files exist in the nginx html directory
RUN ls -la /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"] 