# Use the official Node.js 18 image as a base image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    qpdf \
    exiftool \
 && rm -rf /var/lib/apt/lists/* \
 && npm install

# Copy the rest of your application source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run your app
CMD ["node", "server.js"]
