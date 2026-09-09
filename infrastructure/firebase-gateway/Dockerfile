FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node server.cjs ./server.cjs
USER node
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "server.cjs"]
