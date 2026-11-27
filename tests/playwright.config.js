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
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' },
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    cwd: path.resolve(__dirname, '..'),
    port: PORT,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore', stderr: 'ignore',
  },
  projects: [
    { name: 'laptop', use: { browserName: 'chromium' }, testIgnore: /phone\.spec\.js/ },
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' }, testMatch: /phone\.spec\.js/ },
  ],
});
