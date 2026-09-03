FROM nginx:alpine@sha256:a9ae6f6d078d477e21323310498e5196cb2b7c0aedd9e07b7306612077227d7c
COPY default.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
