FROM node:18-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY hardhat.config.js ./

# Install dependencies
RUN npm install

# Copy contracts and scripts
COPY contracts/ ./contracts/
COPY scripts/ ./scripts/

# Compile contracts
RUN npm run compile

# Expose Hardhat node port
EXPOSE 8545

# Start Hardhat node
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]



