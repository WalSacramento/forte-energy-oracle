FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source files
COPY src/ ./src/
COPY config/ ./config/

# Expose oracle node port (will be overridden by environment)
EXPOSE 4001 4002 4003

# Start oracle node
CMD ["node", "src/index.js"]



