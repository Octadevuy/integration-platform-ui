# Build stage
FROM node:22-alpine3.22 AS builder

# Apply security updates
RUN apk upgrade --no-cache

# Install pnpm
RUN npm install -g pnpm@10.33.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:22-alpine3.22

# Apply security updates
RUN apk upgrade --no-cache

# Install pnpm in production image
RUN npm install -g pnpm@10.33.0

# Set working directory
WORKDIR /app

# Copy package files from builder
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Azure App Service uses this to route traffic to the container port.
ENV PORT=3000

# Start the application
CMD ["pnpm", "start", "-p", "3000"]
