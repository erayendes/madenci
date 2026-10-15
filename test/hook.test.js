'use strict';
// Runs the hook as Claude Code does — a child process with JSON on stdin — against a temp state dir.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'madenci.js');

function run(kind, dir, prompt) {
  const out = execFileSync(process.execPath, [HOOK, kind], {
    env: { ...process.env, MADENCI_STATE_DIR: dir },
    input: prompt === undefined ? '' : JSON.stringify({ prompt }),
    encoding: 'utf8',
  });
  return out ? JSON.parse(out).hookSpecificOutput : null;
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'madenci-'));

test('on by default at full, with the core rules', () => {
  const out = run('session', tmp());
  assert.equal(out.hookEventName, 'SessionStart');
  assert.match(out.additionalContext, /MADENCI ON — level: full/);
  assert.match(out.additionalContext, /The vein/);
  assert.doesNotMatch(out.additionalContext, /With oduncu/); // only the core section is injected
});

test('yat turns it off for later sessions and subagents', () => {
  const dir = tmp();
  assert.match(run('prompt', dir, '/madenci yat').additionalContext, /MADENCI OFF/);
  assert.equal(run('session', dir), null);
  assert.equal(run('subagent', dir), null);
});

test('a level turns it back on and persists', () => {
  const dir = tmp();
  run('prompt', dir, '/madenci yat');
  assert.match(run('prompt', dir, '/madenci:madenci ultra').additionalContext, /level: ultra/);
  assert.match(run('subagent', dir).additionalContext, /level: ultra/);
  assert.match(run('prompt', dir, '/madenci kalk').additionalContext, /level: ultra/);
});

test('reports and ordinary prompts leave state alone and emit nothing', () => {
  const dir = tmp();
  for (const p of ['/madenci debt', '/madenci audit', '/madenci help', 'madenci yat please', 'fix the bug']) {
    assert.equal(run('prompt', dir, p), null, p);
  }
  assert.equal(fs.existsSync(path.join(dir, 'state.json')), false);
});

test('a corrupt state file falls back to the default', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'state.json'), '{nope');
  assert.match(run('session', dir).additionalContext, /level: full/);
});
