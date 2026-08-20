FROM nginx:alpine
RUN echo '{"status":"ok"}' > /usr/share/nginx/html/health
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
