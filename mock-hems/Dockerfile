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

# Expose HEMS API port
EXPOSE 3000

# Start server
CMD ["node", "src/server.js"]


