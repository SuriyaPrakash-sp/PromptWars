const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const publicDirectory = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(publicDirectory, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(publicDirectory, 'styles.css'), 'utf8');

test('key page controls and dialogs retain accessible names and keyboard affordances', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0" \/>/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=/i);
  assert.match(html, /<nav aria-label="Main navigation"/);
  assert.match(html, /<nav aria-label="Mobile navigation"/);
  assert.match(html, /role="dialog" aria-modal="true" aria-labelledby=/);
  assert.match(html, /id="tbl-search" aria-label=/);
  assert.match(html, /id="public-search" aria-label=/);
  assert.match(html, /id="city-map" role="application" aria-label=/);
  assert.match(html, /id="toast-container" aria-live="polite"/);
  assert.match(app, /function handleDialogKeydown\(event\)/);
  assert.match(styles, /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
