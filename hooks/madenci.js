#!/usr/bin/env node
'use strict';
// madenci hook — one script, three events (argv[2]): session | subagent | prompt.
// Reads and writes one small state file; no network, no other files touched.
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

function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return { on: s.on !== false, level: LEVELS.includes(s.level) ? s.level : DEFAULT.level };
  } catch (e) {
    return { ...DEFAULT };
  }
}

function writeState(state) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state) + '\n');
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
function onPrompt(prompt) {
  const m = String(prompt || '').trim().toLowerCase().match(/^\/madenci(?::madenci)?(?:\s+(\S+))?/);
  if (!m) return null;
  const cmd = m[1] || 'kalk';
  const state = readState();
  if (cmd === 'yat') {
    writeState({ ...state, on: false });
    return 'MADENCI OFF. Ignore the madenci rules from earlier in this session; write code normally.';
  }
  if (cmd === 'kalk' || LEVELS.includes(cmd)) {
    const next = { on: true, level: LEVELS.includes(cmd) ? cmd : state.level };
    writeState(next);
    return rules(next.level);
  }
  return null; // debt, audit, help: reports, no state change
}

function main(kind, input) {
  if (kind === 'session' || kind === 'subagent') {
    const state = readState();
    if (state.on) emit(kind === 'session' ? 'SessionStart' : 'SubagentStart', rules(state.level));
    return;
  }
  if (kind === 'prompt') {
    let prompt = '';
    try { prompt = JSON.parse(input.replace(/^﻿/, '')).prompt; } catch (e) { return; }
    const context = onPrompt(prompt);
    if (context) emit('UserPromptSubmit', context);
  }
}

if (require.main === module) {
  const kind = process.argv[2];
  if (kind !== 'prompt') {
    try { main(kind, ''); } catch (e) { /* never block */ }
  } else {
    let input = '';
    const finish = () => { try { main(kind, input); } catch (e) { /* never block */ } process.exit(0); };
    process.stdin.on('data', (c) => { input += c; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
    setTimeout(finish, 1000).unref();
  }
}

module.exports = { onPrompt, readState, rules };
