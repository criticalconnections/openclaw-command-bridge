FROM node:22-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application files
COPY . .

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

# Environment variables
ENV NODE_ENV=production
ENV PORT=3333

# Start server
CMD ["node", "server.js"]
