# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

# Python / Selenium（pagemake 用）+ Playwright 用 Chromium 依存
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY playwright.browser.js playwright.headless.config.js playwright.config.js ./
COPY scraping ./scraping
COPY docker/entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# pagemake サブフォルダがある場合のみ requirements.txt をインストール
RUN --mount=type=bind,source=.,target=/src,readonly \
    if [ -f /src/pagemake/requirements.txt ]; then \
      echo "Installing pagemake requirements from build context..." && \
      pip3 install --break-system-packages -r /src/pagemake/requirements.txt; \
    else \
      echo "pagemake/requirements.txt not found in build context, skipping pip install."; \
    fi

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npx", "playwright", "test", "scraping/scraping.spec.js", "--workers=1", "--config", "playwright.headless.config.js"]
