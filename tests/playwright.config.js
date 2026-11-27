// Playable checks for 5:00 PM Forever. The game is served from the folder above this one
// (the source folder on Ravi's Mac, or the repo root on GitHub Actions).
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const PORT = 8799;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /.*\.spec\.js/,
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // reducedMotion: the game's own fast path (short animations), so a full playthrough takes seconds, not minutes
  use: { baseURL: `http://127.0.0.1:${PORT}`, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' },
  // tests/serve.js: a tiny UTF-8 file server (python's http.server sometimes never answered: lesson L10)
  webServer: {
    command: `node serve.js`,
    cwd: __dirname,
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore', stderr: 'ignore',
  },
  projects: [
    { name: 'laptop', use: { browserName: 'chromium' }, testIgnore: /phone\.spec\.js/ },
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' }, testMatch: /phone\.spec\.js/ },
  ],
});
