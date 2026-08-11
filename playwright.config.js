const { defineConfig } = require('@playwright/test');
const path = require('path');

const htmlPath = path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: `file:///${htmlPath}`,
    browserName: 'chromium',
    viewport: { width: 1400, height: 900 },
  },
});
