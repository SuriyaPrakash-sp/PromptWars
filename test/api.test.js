const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

let server;
let baseUrl;
let dataDirectory;

before(async () => {
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-test-'));
  process.env.CIVICPULSE_DATA_DIR = dataDirectory;
  process.env.ADMIN_PIN = 'test-only-officer-pin';
  process.env.GEMINI_API_KEY = 'your_key_from_aistudio.google.com';

  ({ server } = require('../server'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  if (dataDirectory) fs.rmSync(dataDirectory, { recursive: true, force: true });
});

test('API validates input, protects officer operations, and exports safe CSV', async () => {
  const meta = await fetch(`${baseUrl}/api/meta`);
  assert.equal(meta.status, 200);
  assert.equal(meta.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(meta.headers.get('cache-control'), 'no-store');
  assert.equal(meta.headers.get('access-control-allow-origin'), null);

  const publicIssues = await fetch(`${baseUrl}/api/issues`);
  assert.equal(publicIssues.status, 200);
  const seededIssue = (await publicIssues.json()).find(issue => issue.id === 'CR-1001');
  assert.ok(seededIssue);
  assert.equal('reporterPhone' in seededIssue, false);
  assert.equal('internalNotes' in seededIssue, false);

  const malformed = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{'
  });
  assert.equal(malformed.status, 400);

  const invalidGrievance = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '   ', description: 'Details', location: 'Main Street' })
  });
  assert.equal(invalidGrievance.status, 400);

  for (const endpoint of ['/api/seed', '/api/export/csv', '/api/audit-log']) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: endpoint === '/api/seed' ? 'POST' : 'GET'
    });
    assert.equal(response.status, 401, `${endpoint} requires officer authentication`);
  }

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: 'test-only-officer-pin' })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, 'admin-session-active');
  const officerHeaders = { Authorization: `Bearer ${token}` };

  const legacyPinAccess = await fetch(`${baseUrl}/api/seed`, {
    method: 'POST',
    headers: { 'x-admin-pin': 'test-only-officer-pin' }
  });
  assert.equal(legacyPinAccess.status, 401);

  const badCategory = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Broken streetlight',
      description: 'Light has been out for two days.',
      location: 'Main Street',
      category: 'Not an official category'
    })
  });
  assert.equal(badCategory.status, 400);

  const badImage = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Broken streetlight',
      description: 'Light has been out for two days.',
      location: 'Main Street',
      image: 'data:image/svg+xml,<svg onload=alert(1)>'
    })
  });
  assert.equal(badImage.status, 400);

  const badCoordinates = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Broken streetlight',
      description: 'Light has been out for two days.',
      location: 'Main Street',
      lat: null,
      lng: null
    })
  });
  assert.equal(badCoordinates.status, 400);

  const created = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '=2+2',
      description: 'Broken streetlight has been out for two days.',
      location: 'Main Street',
      category: 'Broken / Non-Functional Streetlight',
      ward: 'Ward 01 - North Gateway & Harborside'
    })
  });
  assert.equal(created.status, 201);
  const issue = await created.json();
  assert.equal('reporterPhone' in issue, false);
  assert.equal('internalNotes' in issue, false);

  const badUpdate = await fetch(`${baseUrl}/api/issues/${issue.id}`, {
    method: 'PATCH',
    headers: { ...officerHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Deleted' })
  });
  assert.equal(badUpdate.status, 400);

  const reset = await fetch(`${baseUrl}/api/seed`, {
    method: 'POST',
    headers: officerHeaders
  });
  assert.equal(reset.status, 200);

  const publicDelete = await fetch(`${baseUrl}/api/issues/CR-1001`, { method: 'DELETE' });
  assert.equal(publicDelete.status, 401);

  const update = await fetch(`${baseUrl}/api/issues/CR-1001`, {
    method: 'PATCH',
    headers: { ...officerHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Dispatched', note: 'Crew assigned.' })
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).status, 'Dispatched');

  const withCsvFormula = await fetch(`${baseUrl}/api/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '=HYPERLINK("https://example.invalid")',
      description: 'A reported road surface issue for CSV export validation.',
      location: 'Test Avenue'
    })
  });
  assert.equal(withCsvFormula.status, 201);

  const csv = await fetch(`${baseUrl}/api/export/csv`, { headers: officerHeaders });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failedLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: 'incorrect-pin' })
    });
    assert.equal(failedLogin.status, 401);
  }
  const rateLimited = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: 'incorrect-pin' })
  });
  assert.equal(rateLimited.status, 429);
});

test('static file requests cannot escape the public directory', async () => {
  const response = await fetch(`${baseUrl}/%2e%2e%2fserver.js`);
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /<!DOCTYPE html>/i);
  assert.doesNotMatch(body, /const http = require/);
});

test('rules engine classifies common hazards and exposes public tracking actions', async () => {
  const cases = [
    ['Open uncovered manhole near a school', 'A child could fall into the open pit.', 'Drainage & Flood Management', 'Critical'],
    ['Live wire sparking above the footpath', 'The electric cable is hanging and sparking.', 'Street Lighting & Electricity', 'Critical'],
    ['Garbage dump beside the school', 'Rotting waste has blocked the market footpath.', 'Sanitation & Solid Waste', 'High'],
    ['Burst drinking water pipeline', 'Water loss has continued and contaminated the street.', 'Water Supply & Sewage', 'High'],
    ['Deep pothole on the main highway', 'A bus nearly skidded in the road crater.', 'Roads & Public Works', 'High'],
    ['Fallen tree in the park', 'A large branch fell across the park walkway.', 'Parks, Gardens & Horticulture', 'High'],
    ['Traffic signal stuck at intersection', 'The signal is not changing for cross traffic.', 'Traffic, Signage & Mobility', 'High'],
    ['Dengue mosquito breeding hazard', 'Mosquitoes are breeding near the homes.', 'Public Health & Vector Control', 'High'],
    ['Park garden needs routine maintenance', 'The garden is overgrown but no immediate hazard exists.', 'Parks, Gardens & Horticulture', 'Low'],
    ['Request for a municipal service', 'Please inspect this local civic concern.', 'Roads & Public Works', 'Medium']
  ];

  let firstIssue;
  for (const [title, description, department, priority] of cases) {
    const response = await fetch(`${baseUrl}/api/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, location: `Test location ${title}` })
    });
    assert.equal(response.status, 201, title);
    const issue = await response.json();
    assert.equal(issue.department, department, title);
    assert.equal(issue.priority, priority, title);
    assert.equal(issue.ai.source, 'smart-rules-engine');
    if (!firstIssue) firstIssue = issue;
  }

  const dossierResponse = await fetch(`${baseUrl}/api/issues/${firstIssue.id}`);
  assert.equal(dossierResponse.status, 200);
  const dossier = await dossierResponse.json();
  assert.equal('reporter' in dossier, false);
  assert.equal('reporterPhone' in dossier, false);
  assert.equal('internalNotes' in dossier, false);

  const vote = await fetch(`${baseUrl}/api/issues/${firstIssue.id}/upvote`, { method: 'POST' });
  assert.equal(vote.status, 200);
  assert.equal((await vote.json()).upvotes, 2);

  const comment = await fetch(`${baseUrl}/api/issues/${firstIssue.id}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: 'Barricades are now visible.' })
  });
  assert.equal(comment.status, 200);
  assert.match((await comment.json()).history.at(-1).note, /Barricades are now visible/);

  const analytics = await fetch(`${baseUrl}/api/analytics`);
  assert.equal(analytics.status, 200);
  const report = await analytics.json();
  assert.ok(report.summary.total >= cases.length);
  assert.ok(report.priorityBreakdown.critical >= 2);
});
