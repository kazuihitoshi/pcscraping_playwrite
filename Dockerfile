FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY playwright.browser.js playwright.headless.config.js playwright.config.js ./
COPY scraping ./scraping

CMD [
  "npx", "playwright", "test",
  "scraping/scraping.spec.js",
  "--workers=1",
  "--config", "playwright.headless.config.js"
]
