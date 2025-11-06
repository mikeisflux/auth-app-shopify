FROM node:18

WORKDIR /

# Copy root package.json and package-lock.json (contains backend deps)
COPY package*.json ./

# Install only backend dependencies
RUN npm install --production --legacy-peer-deps

# Copy backend code
COPY backend ./backend

# Copy pre-built frontend
COPY frontend/build ./frontend/build

EXPOSE 3000

CMD ["node", "backend/server.js"]
