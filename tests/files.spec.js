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

test('promo video: every screen the recording script clicks still exists in the game', () => {
  const rec = fs.readFileSync(path.join(root, 'promo/record.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ids = [...new Set([...rec.matchAll(/'#([a-z0-9-]+)/g)].map(m => m[1]))].filter(id => !id.startsWith('card-'));
  expect(ids.length).toBeGreaterThan(10);
  const missing = ids.filter(id => !html.includes(`id="${id}"`));
  expect(missing, 'promo/record.js clicks screens that no longer exist; update it and re-record').toEqual([]);
  expect(fs.readFileSync(path.join(root, 'game/engine.js'), 'utf8')).toContain('`Day ${S.loop}`');   // record.js reads "Day 1"
});
