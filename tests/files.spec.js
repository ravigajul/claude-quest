// Checks on files that shape the GitHub page and link previews (no browser needed).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('LICENSE is plain MIT so GitHub recognises it', () => {
  const lic = read('LICENSE');
  expect(lic.startsWith('MIT License')).toBe(true);
  expect(lic.trim().endsWith('SOFTWARE.')).toBe(true);   // nothing after the standard text
});

test('link preview: current wording, picture, and credit', () => {
  const head = read('pages_head.html');
  expect(head).not.toContain('You are the AI agent');
  expect(head).toMatch(/property="og:image" content="https:\/\/ravigajul\.github\.io\/claude-quest\/social\.png"/);
  expect(head).toContain('Ravi Gajul');
  expect(fs.existsSync(path.join(root, 'social.png'))).toBe(true);
});

test('README credits Ravi, explains privacy and mentions Google Fonts', () => {
  const readme = read('README.md');
  expect(readme).toContain('Ravi Gajul');
  expect(readme).toMatch(/Privacy/);
  expect(readme).toMatch(/Google Fonts/);
});

test('no private email in any shipped file', () => {
  const files = ['index.html', 'README.md', 'PLAN.md', ...fs.readdirSync(path.join(root, 'game')).map(f => 'game/' + f)];
  for (const f of files) expect(read(f), f).not.toMatch(/ravigajul2201|@gmail\.com/);
});
