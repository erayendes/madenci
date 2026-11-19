'use strict';
// Feeds learn.js a fake Claude Code transcript folder through CLAUDE_CONFIG_DIR.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scan, suggestLevel, userText, transcriptFiles } = require('../skills/madenci/scripts/learn.js');

const user = (content, extra = {}) => ({ type: 'user', timestamp: '2026-11-01T10:00:00Z', message: { role: 'user', content }, ...extra });
const write = (entries) => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'madenci-t-')), 's.jsonl');
  fs.writeFileSync(f, entries.map((x) => JSON.stringify(x)).join('\n'));
  return f;
};
const edit = (file) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: file } }] } });

test('userText keeps what the human typed and drops harness messages', () => {
  assert.equal(userText(user('bu gereksiz')), 'bu gereksiz');
  assert.equal(userText(user([{ type: 'text', text: 'fix it' }, { type: 'tool_result', content: 'x' }])), 'fix it');
  assert.equal(userText(user([{ type: 'tool_result', content: 'gereksiz' }])), '');
  assert.equal(userText(user('<task-notification> missing </task-notification>')), '');
  assert.equal(userText(user('<command-name>/madenci</command-name>')), '');
  assert.equal(userText(user('gerek yok', { isMeta: true })), '');
  assert.equal(userText(user('gerek yok', { origin: { kind: 'task' } })), '');
  assert.equal(userText(user('ok <system-reminder>remove this</system-reminder>')), 'ok');
});

test('the words reach beyond Turkish and English', () => {
  for (const t of ['esto es innecesario', 'das ist überflüssig', 'убери это', 'これは不要', '这个多余', '이건 불필요해']) {
    assert.ok(scan([write([user('a'), edit('/x/a.js'), user(t)])]).less.length === 1, t);
  }
  assert.equal(scan([write([user('a'), edit('/x/a.js'), user('du hast die Tests vergessen')])]).more.length, 1);
});

test('scan finds pushback after code edits, in words or in lines removed, once per message', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'madenci-learn-'));
  const cwd = '/w/my.app';
  const dir = path.join(root, 'projects', '-w-my-app');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, 'projects', '-w-my-app--claude-worktrees-x'));
  fs.mkdirSync(path.join(root, 'projects', '-w-my-app-other'));
  const shrink = (file, n) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit',
    input: { file_path: file, old_string: 'x\n'.repeat(n), new_string: 'x' } }] } });
  const lines = [user('makinedeki yedekleri kaldır'), user('add a cache'), edit('/w/my.app/src/cache.js'),
    user('bu wrapper gereksiz, kaldır'), edit('/w/my.app/src/cache.js'), user('you forgot the tests'),
    edit('/w/my.app/src/api.js'), user('zbyt dużo kodu'), shrink('/w/my.app/src/api.js', 6),
    user('ok'), shrink('/w/my.app/src/other.js', 9), 'not json'];
  fs.writeFileSync(path.join(dir, 'a.jsonl'), lines.map((l) => typeof l === 'string' ? l : JSON.stringify(l)).join('\n'));
  fs.writeFileSync(path.join(root, 'projects', '-w-my-app--claude-worktrees-x', 'b.jsonl'), JSON.stringify(user('bu wrapper gereksiz, kaldır')));
  fs.writeFileSync(path.join(root, 'projects', '-w-my-app-other', 'c.jsonl'), JSON.stringify(user('gerek yok')));

  process.env.CLAUDE_CONFIG_DIR = root;
  const files = transcriptFiles(cwd);
  delete process.env.CLAUDE_CONFIG_DIR;
  assert.equal(files.length, 2); // the project and its worktree, not -other

  const s = scan(files);
  assert.equal(s.messages, 6);
  // "yedekleri kaldır" follows no edit; "ok" is followed by removals in a file it did not see.
  assert.deepEqual(s.less.map((h) => [h.text, h.files, h.removed]),
    [['bu wrapper gereksiz, kaldır', ['cache.js'], undefined], ['zbyt dużo kodu', ['api.js'], 6]]);
  assert.deepEqual(s.more.map((h) => h.text), ['you forgot the tests']);
  assert.equal(scan(files, '2026-12-01').messages, 0);
});

test('suggestLevel needs a clear lean before it moves off full', () => {
  assert.equal(suggestLevel(0, 0), 'full');
  assert.equal(suggestLevel(2, 0), 'full');
  assert.equal(suggestLevel(6, 3), 'ultra');
  assert.equal(suggestLevel(5, 3), 'full');
  assert.equal(suggestLevel(1, 4), 'lite');
});
