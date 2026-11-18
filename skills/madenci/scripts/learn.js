#!/usr/bin/env node
'use strict';
// madenci learn — reads this project's Claude Code transcripts and git log, locally, and prints
// the evidence the agent turns into project rules (see references/learn.md). Writes nothing.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// shortcut: words cover tr, en, es, pt, fr, de, it, ru, ja, zh, ko; other languages count only through
// the "agent then removed lines" signal in scan(). The agent drops the noise in references/learn.md step 2.
// The user asked for less: code called unnecessary, removed or simplified.
const LESS = new RegExp([
  'gereksiz|gerek yok|lüzumsuz|abartma|fazla karmaşık|çok fazla|sadeleştir|basitleştir|kaldır(?!aç)', // tr
  'over-?engineer|overkill|too (much|complex)|unnecessary|not needed|no need|simplif|remove (this|that|it|the)|yagni|bloat', // en
  'innecesari|quita (esto|eso)|elimina (esto|eso)|simplifica', // es
  'desnecessári|remova|simplifique', // pt
  'inutile|supprime|simplifie|trop compliqué', // fr, it
  'unnötig|überflüssig|entfern|vereinfach|zu kompliziert', // de
  'rimuovi|semplifica', // it
  'лишн|убери|удали|упрост|слишком сложн|не нужн', // ru
  '不要|いらない|削除|消して|シンプルに|やりすぎ', // ja
  '不需要|多余|删除|删掉|简化|太复杂', // zh
  '필요 ?없|불필요|삭제|지워|단순하게', // ko
].join('|'), 'i');
// The user asked for more: the change was left unfinished.
const MORE = new RegExp([
  'eksik|unuttun|atlamışsın|bunu da ekle|şunu da ekle|yarım kalmış', // tr
  'you forgot|missing|incomplete|also add|didn\'?t finish|left out', // en
  'falta|olvidaste|incomplet', // es, pt, fr
  'faltou|esqueceu|esqueceste', // pt
  'manque|oublié', // fr
  'fehlt|vergessen|unvollständig', // de
  'manca|dimenticat', // it
  'забыл|не хватает|недодел|неполн', // ru
  '足りない|忘れ|抜けて', // ja
  '漏了|忘了|缺少|不完整', // zh
  '빠졌|잊었|누락', // ko
].join('|'), 'i');
// A user message right after code edits, then this many more lines removed than added in those
// files, counts as "asked for less" in any language.
const REMOVED_LINES = 3;
const GIT_LESS = /revert|remove (unused|dead)|simplif|clean ?up|kaldır|sadeleştir|gereksiz/i;
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];

// The project's transcript folder, plus its Claude Code worktrees, oldest first: a resumed session
// copies earlier messages, and scan() must meet the original, with its edits, first.
function transcriptFiles(cwd) {
  const root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const name = cwd.replace(/[^a-zA-Z0-9]/g, '-');
  let dirs = [];
  try { dirs = fs.readdirSync(root).filter((d) => d === name || d.startsWith(name + '--claude-worktrees-')); } catch (e) { /* none */ }
  const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
  return dirs.flatMap((d) => {
    try { return fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(root, d, f)); } catch (e) { return []; }
  }).map((f) => [f, mtime(f)]).sort((x, y) => x[1] - y[1]).map(([f]) => f);
}

// What the human typed, or '' for tool results, slash commands and harness messages.
function userText(entry) {
  if (entry.type !== 'user' || entry.isMeta || entry.isSidechain) return '';
  if (entry.origin && entry.origin.kind && entry.origin.kind !== 'human') return '';
  const c = entry.message && entry.message.content;
  const text = typeof c === 'string' ? c
    : Array.isArray(c) ? c.filter((p) => p && p.type === 'text').map((p) => p.text).join('\n') : '';
  // Harness messages open with a tag: <task-notification>, <command-name>, <cross-session-message>…
  if (/<command-name>|^\s*<[a-z][\w-]*[ >]|^\[Request interrupted/.test(text)) return '';
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
}

// Lines an edit takes away, net: positive when it removes more than it adds.
function removedLines(name, input) {
  const count = (s) => (typeof s === 'string' && s ? s.split('\n').length : 0);
  const edits = name === 'MultiEdit' ? input.edits : name === 'Edit' ? [input] : [];
  return (Array.isArray(edits) ? edits : []).reduce((n, e) => n + count(e && e.old_string) - count(e && e.new_string), 0);
}

// since: an ISO time; older messages are skipped.
function scan(files, since = '') {
  const out = { sessions: files.length, messages: 0, less: [], more: [] };
  const seen = new Set(); // resumed and forked sessions copy earlier messages
  for (const file of files) {
    let edited = new Set();
    let open = null; // the last user message after edits, waiting to see what the agent did next
    const settle = () => { if (open && !open.counted && open.removed >= REMOVED_LINES) out.less.push({ ...open.hit, removed: open.removed }); };
    let lines = [];
    try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch (e) { continue; }
    for (const line of lines) {
      let e;
      try { e = JSON.parse(line); } catch (err) { continue; }
      if (e.type === 'assistant') {
        for (const p of [].concat((e.message && e.message.content) || [])) {
          if (!(p && p.type === 'tool_use' && EDIT_TOOLS.includes(p.name) && p.input && p.input.file_path)) continue;
          const name = path.basename(p.input.file_path);
          if (open && open.files.has(name)) open.removed += removedLines(p.name, p.input);
          edited.add(name);
        }
        continue;
      }
      const text = userText(e);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      settle();
      open = null;
      if (String(e.timestamp || '') < since) { edited = new Set(); continue; }
      out.messages++;
      // Pushback on code follows code edits, and is short: a long message is a pasted document.
      if (edited.size && text.length < 1000) {
        const hit = { at: String(e.timestamp || '').slice(0, 10), text: text.replace(/\s+/g, ' ').slice(0, 200), files: [...edited] };
        const counted = LESS.test(text) ? out.less.push(hit) : MORE.test(text) ? out.more.push(hit) : 0;
        open = { hit, files: edited, removed: 0, counted };
      }
      edited = new Set();
    }
    settle();
  }
  return out;
}

function suggestLevel(less, more) {
  if (less >= 3 && less >= 2 * more) return 'ultra';
  if (more >= 3 && more >= 2 * less) return 'lite';
  return 'full';
}

function gitLess(cwd) {
  try {
    const log = execFileSync('git', ['-C', cwd, 'log', '-n', '300', '--format=%h %s'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return log.split('\n').filter((l) => GIT_LESS.test(l));
  } catch (e) {
    return [];
  }
}

function main(argv) {
  const i = argv.indexOf('--project');
  const cwd = path.resolve(i === -1 ? process.cwd() : argv[i + 1] || '.');
  const files = transcriptFiles(cwd);
  const s = scan(files);
  const commits = gitLess(cwd);
  const section = (title, lines) =>
    console.log(`\n${title} (${lines.length}):${lines.length ? '\n' + lines.slice(0, 15).map((l) => '  ' + l).join('\n') : ' none'}`);
  const hits = (list) => list.sort((a, b) => b.at.localeCompare(a.at))
    .map((h) => `${h.at}  "${h.text}"  ← after edits to ${h.files.join(', ')}${h.removed ? `; the agent then removed ${h.removed} lines` : ''}`);

  console.log(`madenci learn — ${cwd}`);
  console.log(files.length
    ? `${s.sessions} Claude Code sessions, ${s.messages} of your messages read.`
    : 'No Claude Code transcripts for this folder; git log only.');
  section('Asked for less', hits(s.less));
  section('Asked for more', hits(s.more));
  section('Commits that trimmed code', commits);
  const level = suggestLevel(s.less.length, s.more.length);
  console.log(`\nSuggested level: ${level} (${s.less.length} asked for less, ${s.more.length} for more) — set it with /madenci ${level}`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { main, scan, suggestLevel, userText, transcriptFiles };
