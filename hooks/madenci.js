#!/usr/bin/env node
'use strict';
// madenci hook — one script, four events (argv[2]): session | subagent | prompt | guard.
// Reads and writes one small state file; guard also reads the file an edit targets. No network.
// Every failure exits 0 silently: a hook must never block or slow the agent.

const fs = require('fs');
const os = require('os');
const path = require('path');

const LEVELS = ['lite', 'full', 'ultra'];
const DEFAULT = { on: true, level: 'full' };

const stateDir = process.env.MADENCI_STATE_DIR ||
  (process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'madenci')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'madenci'));
const stateFile = path.join(stateDir, 'state.json');

const WEEK = 7 * 24 * 60 * 60 * 1000;
const obj = (v) => (v && typeof v === 'object' ? v : {});

// on/off and the default level are global. Per folder: `projects` its level, `learned` the last
// /madenci learn, `nudged` the last reminder to run it.
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return {
      on: s.on !== false,
      level: LEVELS.includes(s.level) ? s.level : DEFAULT.level,
      projects: obj(s.projects),
      learned: obj(s.learned),
      nudged: obj(s.nudged),
    };
  } catch (e) {
    return { ...DEFAULT, projects: {}, learned: {}, nudged: {} };
  }
}

function writeState(state) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state) + '\n');
}

// The deepest project folder holding cwd sets the level; otherwise the global one.
function levelFor(state, cwd) {
  const dir = String(cwd || '');
  let best = '';
  for (const p of Object.keys(state.projects)) {
    if ((dir === p || dir.startsWith(p + path.sep)) && p.length > best.length && LEVELS.includes(state.projects[p])) best = p;
  }
  return best ? state.projects[best] : state.level;
}

// The rules live once, in SKILL.md, between the madenci:core markers.
function rules(level) {
  let core = '';
  try {
    const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'madenci', 'SKILL.md'), 'utf8');
    core = (skill.match(/<!-- madenci:core -->([\s\S]*?)<!-- \/madenci:core -->/) || [])[1] || '';
  } catch (e) { /* fall through to the short form */ }
  return `MADENCI ON — level: ${level}. Off: /madenci yat. Level: /madenci lite|full|ultra.\n` +
    (core.trim() || 'Write the smallest complete change: reuse what exists, stdlib first, no unrequested abstraction or dependency.');
}

function emit(event, context) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
}

// Returns the context to inject for a prompt, or null when the prompt is not a madenci command.
function onPrompt(prompt, cwd) {
  const m = String(prompt || '').trim().toLowerCase().match(/^\/madenci(?::madenci)?(?:\s+(\S+))?/);
  if (!m) return null;
  const cmd = m[1] || 'kalk';
  const state = readState();
  if (cmd === 'yat') {
    writeState({ ...state, on: false });
    return 'MADENCI OFF. Ignore the madenci rules from earlier in this session; write code normally.';
  }
  if (cmd === 'kalk' || LEVELS.includes(cmd)) {
    const next = { ...state, on: true };
    if (LEVELS.includes(cmd)) {
      if (cwd) next.projects = { ...state.projects, [cwd]: cmd };
      else next.level = cmd;
    }
    writeState(next);
    return rules(levelFor(next, cwd));
  }
  if (cmd === 'learn' && cwd) writeState({ ...state, learned: { ...state.learned, [cwd]: new Date().toISOString() } });
  return null; // debt, audit, learn, help: reports
}

// Users forget /madenci learn, so at most once a week, when new evidence has piled up, the agent
// is asked to mention it. Empty string when there is nothing to say.
function learnNudge(state, cwd) {
  if (!cwd || Date.now() - (Date.parse(state.nudged[cwd]) || 0) < WEEK) return '';
  const { transcriptFiles, scan } = require(path.join(__dirname, '..', 'skills', 'madenci', 'scripts', 'learn.js'));
  const since = state.learned[cwd] || '';
  const files = transcriptFiles(cwd)
    .filter((f) => fs.statSync(f).mtimeMs > (Date.parse(since) || 0))
    .slice(-100); // the newest 100: stay inside the hook timeout
  const s = scan(files, since);
  const n = s.less.length + s.more.length;
  if (n < 3) return '';
  writeState({ ...state, nudged: { ...state.nudged, [cwd]: new Date().toISOString() } });
  return `\n\nmadenci learn: ${n} times ${since ? 'since the last /madenci learn' : 'in this project'}, the user trimmed ` +
    'or finished code an agent wrote. In your first reply, add one line in the user\'s language: ' +
    '/madenci learn can turn these into rules for this project.';
}

const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const TEST_PATH = /(^|[/\\._-])(tests?|specs?|__tests__)([/\\._-]|$)/i;

// shortcut: dependency check covers package.json and requirements*.txt only; add a manifest when a user's stack needs it.
function deps(name, text) {
  if (name === 'package.json') {
    try {
      const j = JSON.parse(text);
      return DEP_KEYS.flatMap((k) => Object.keys((j && j[k]) || {}));
    } catch (e) { return []; }
  }
  if (/^requirements[\w.-]*\.txt$/.test(name)) {
    return text.split('\n').map((l) => l.replace(/#.*/, '').trim().split(/[\s<>=!~[;@]/)[0]).filter((n) => n && !n.startsWith('-'));
  }
  return null;
}

// What an Edit/MultiEdit leaves in the file, or null when the edit cannot be replayed.
function afterEdit(tool, input, before) {
  const edits = tool === 'MultiEdit' ? input.edits : tool === 'Edit' ? [input] : null;
  if (!Array.isArray(edits)) return null;
  let text = before;
  for (const e of edits) {
    if (!e || typeof e.old_string !== 'string' || typeof e.new_string !== 'string') return null;
    text = e.replace_all ? text.split(e.old_string).join(e.new_string) : text.replace(e.old_string, () => e.new_string);
  }
  return text;
}

// PreToolUse on Write/Edit/MultiEdit: a one-line nudge for a new dependency or a new source file. Never blocks.
function onTool(data) {
  const input = data.tool_input || {};
  if (typeof input.file_path !== 'string') return null;
  const file = path.resolve(String(data.cwd || ''), input.file_path);
  const name = path.basename(file);
  let before = null;
  try { before = fs.readFileSync(file, 'utf8'); } catch (e) { /* a new file */ }

  if (before === null) {
    if (data.tool_name !== 'Write' || TEST_PATH.test(path.relative(String(data.cwd || ''), file))) return null;
    return `madenci: ${name} is a new file. Fine if the task needs it; otherwise put the code in an existing file.`;
  }
  const after = data.tool_name === 'Write' ? input.content : afterEdit(data.tool_name, input, before);
  const was = deps(name, before);
  if (!was || typeof after !== 'string') return null;
  const added = deps(name, after).filter((d) => !was.includes(d));
  if (!added.length) return null;
  return `madenci: this edit adds ${added.join(', ')} to ${name}. Keep it only if no installed dependency, ` +
    'the standard library or the platform does the job, and the task needs more than a few lines from it.';
}

function main(kind, input) {
  let data = {};
  try { data = JSON.parse(input.replace(/^﻿/, '')) || {}; } catch (e) { /* no input: defaults */ }
  if (kind === 'prompt') {
    const context = onPrompt(data.prompt, data.cwd);
    if (context) emit('UserPromptSubmit', context);
    return;
  }
  const state = readState();
  if (!state.on) return;
  if (kind === 'session' || kind === 'subagent') {
    let nudge = '';
    if (kind === 'session' && data.source === 'startup') {
      try { nudge = learnNudge(state, data.cwd); } catch (e) { /* the rules still go out */ }
    }
    emit(kind === 'session' ? 'SessionStart' : 'SubagentStart', rules(levelFor(state, data.cwd)) + nudge);
  } else if (kind === 'guard') {
    const context = onTool(data);
    if (context) emit('PreToolUse', context);
  }
}

if (require.main === module) {
  const kind = process.argv[2];
  let input = '';
  const finish = () => { try { main(kind, input); } catch (e) { /* never block */ } process.exit(0); };
  process.stdin.on('data', (c) => { input += c; });
  process.stdin.on('end', finish);
  process.stdin.on('error', finish);
  setTimeout(finish, 1000).unref();
}

module.exports = { onPrompt, onTool, readState, levelFor, rules };
