'use strict';
// Runs the hook as Claude Code does — a child process with JSON on stdin — against a temp state dir.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOK = path.join(__dirname, '..', 'hooks', 'madenci.js');

// input: a prompt string, or the whole hook payload as an object.
function run(kind, dir, input, env = {}) {
  const out = execFileSync(process.execPath, [HOOK, kind], {
    env: { ...process.env, MADENCI_STATE_DIR: dir, ...env },
    input: input === undefined ? '' : JSON.stringify(typeof input === 'string' ? { prompt: input } : input),
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

test('a level set inside a project applies there and below, not elsewhere', () => {
  const dir = tmp();
  assert.match(run('prompt', dir, { prompt: '/madenci ultra', cwd: '/w/app' }).additionalContext, /level: ultra/);
  assert.match(run('session', dir, { cwd: '/w/app/pkg' }).additionalContext, /level: ultra/);
  assert.match(run('subagent', dir, { cwd: '/w/app' }).additionalContext, /level: ultra/);
  assert.match(run('session', dir, { cwd: '/w/application' }).additionalContext, /level: full/);
  run('prompt', dir, { prompt: '/madenci lite', cwd: '/w/app/pkg' });
  assert.match(run('session', dir, { cwd: '/w/app/pkg/src' }).additionalContext, /level: lite/);
  assert.match(run('session', dir, { cwd: '/w/app' }).additionalContext, /level: ultra/);
});

test('guard flags a dependency added to package.json, by Edit or Write', () => {
  const dir = tmp();
  const pkg = path.join(dir, 'package.json');
  const before = JSON.stringify({ name: 'x', dependencies: { a: '1' } }, null, 2);
  fs.writeFileSync(pkg, before);
  const edit = (old_string, new_string) =>
    run('guard', dir, { tool_name: 'Edit', cwd: dir, tool_input: { file_path: pkg, old_string, new_string } });

  assert.match(edit('"a": "1"', '"a": "1",\n    "lodash": "4"').additionalContext, /adds lodash to package\.json/);
  assert.equal(edit('"name": "x"', '"name": "y"'), null); // no new dependency
  const write = run('guard', dir, { tool_name: 'Write', cwd: dir,
    tool_input: { file_path: 'package.json', content: JSON.stringify({ devDependencies: { a: '1', jest: '29' } }) } });
  assert.match(write.additionalContext, /adds jest/);
});

test('guard reads requirements.txt line by line', () => {
  const dir = tmp();
  const req = path.join(dir, 'requirements.txt');
  fs.writeFileSync(req, 'flask==3.0  # web\n-r base.txt\n');
  const out = run('guard', dir, { tool_name: 'Write', cwd: dir,
    tool_input: { file_path: req, content: 'flask==3.0\n-r base.txt\nrequests>=2\n' } });
  assert.match(out.additionalContext, /adds requests to requirements\.txt/);
});

test('guard notes a new source file, not a new test, and stays quiet when off', () => {
  const dir = tmp();
  const write = (file) => run('guard', dir, { tool_name: 'Write', cwd: dir, tool_input: { file_path: path.join(dir, file), content: 'x' } });
  assert.match(write('src/helpers.js').additionalContext, /helpers\.js is a new file/);
  assert.equal(write('test/helpers.test.js'), null);
  assert.equal(run('guard', dir, { tool_name: 'Edit', cwd: dir, tool_input: { file_path: path.join(dir, 'nope.js'), old_string: 'a', new_string: 'b' } }), null);
  run('prompt', dir, '/madenci yat');
  assert.equal(write('src/other.js'), null);
});

test('a new session reminds about learn once a week, and not right after one', () => {
  const dir = tmp();
  const root = tmp();
  const cwd = '/w/app';
  fs.mkdirSync(path.join(root, 'projects', '-w-app'), { recursive: true });
  const edit = { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/w/app/a.js' } }] } };
  const user = (content) => ({ type: 'user', timestamp: new Date().toISOString(), message: { content } });
  const lines = ['a', 'gereksiz', 'b', 'remove this', 'c', 'you forgot the tests'].map((t) => [user(t), edit]).flat();
  fs.writeFileSync(path.join(root, 'projects', '-w-app', 's.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
  const env = { CLAUDE_CONFIG_DIR: root };
  const start = () => run('session', dir, { cwd, source: 'startup' }, env).additionalContext;

  assert.match(start(), /madenci learn: 3 times in this project/);
  assert.doesNotMatch(start(), /madenci learn:/); // nudged this week
  assert.doesNotMatch(run('session', dir, { cwd, source: 'resume' }, env).additionalContext, /madenci learn:/);

  const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ ...state, nudged: {} }));
  run('prompt', dir, { prompt: '/madenci learn', cwd }, env);
  assert.doesNotMatch(start(), /madenci learn:/); // nothing new since that learn
});
