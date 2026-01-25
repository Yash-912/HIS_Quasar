FROM node:18-alpine

WORKDIR /app

# Install system dependencies (including OCR tools if needed)
# Note: Using alpine packages which are different from Debian
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    tesseract-ocr
    # Added tesseract-ocr to be safe since traineddata exists in repo

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
