FROM nginx:alpine
COPY . /usr/share/nginx/html/
# Ajout d'un point de terminaison pour le healthcheck (utilisé par la pipeline)
RUN echo '{"status":"ok"}' > /usr/share/nginx/html/health
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
