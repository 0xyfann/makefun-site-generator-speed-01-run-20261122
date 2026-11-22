// SPDX-License-Identifier: MIT
// Markdown: its own subset, rendered in one fused pass. Blocks are recognised
// line by line and written straight into the output chunks — no token arrays,
// no intermediate block list. Inline markup is scanned left to right; plain
// text runs are escaped in bulk with a single regex call per run instead of
// one call per character. No raw HTML (every < is escaped), no setext headings,
// no indented code, no tables, no reference links, no underscore emphasis.

import { escapeHtml, slugify, uniqueSlug } from './text.js';

const BLANK = /^[ \t]*$/;
const FENCE_OPEN = /^```([A-Za-z0-9_+-]*)[ \t]*$/;
const FENCE_CLOSE = /^```[ \t]*$/;
const HEADING = /^(#{1,6})[ \t]+(.*?)[ \t]*$/;
const HR = /^(?:---|\*\*\*)[ \t]*$/;
const BULLET = /^[-*] (.*)$/;
const ORDERED = /^(\d{1,9})\. (.*)$/;
const CONTINUED = /^ {2,}\S/;

/** A heading line's level and text, or null (a heading's text is never empty). */
function headingOf(line) {
  const m = HEADING.exec(line);
  return m === null || m[2] === '' ? null : { depth: m[1].length, text: m[2] };
}

/** Whether `line` ends a paragraph: a blank line, a fence, a heading or a thematic break. */
function endsParagraph(line) {
  const c = line[0];
  if (c === undefined) return true;
  if (c === ' ' || c === '\t') return BLANK.test(line);
  if (c === '`') return FENCE_OPEN.test(line);
  if (c === '#') return headingOf(line) !== null;
  if (c === '-' || c === '*') return HR.test(line);
  return false;
}

/** A paragraph line as it is rendered: spaces and tabs at either end dropped. */
function trimLine(line) {
  let a = 0;
  let b = line.length;
  while (a < b && (line[a] === ' ' || line[a] === '\t')) a++;
  while (b > a && (line[b - 1] === ' ' || line[b - 1] === '\t')) b--;
  return line.slice(a, b);
}

/** The characters a backslash escapes. */
const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '(', ')', '#', '+', '-', '.', '!', '>']);

/** The first index from `from` where `s` holds `what` outside a backslash escape, or -1. */
function findUnescaped(s, what, from) {
  for (let j = from; j <= s.length - what.length; j++) {
    if (s[j] === '\\' && j + 1 < s.length && ESCAPABLE.has(s[j + 1])) {
      j++;
      continue;
    }
    if (s.startsWith(what, j)) return j;
  }
  return -1;
}

/** The first single * from `from` (one whose run is not **), outside an escape, or -1. */
function findSingleStar(s, from) {
  for (let j = from; j < s.length; j++) {
    const c = s[j];
    if (c === '\\' && j + 1 < s.length && ESCAPABLE.has(s[j + 1])) {
      j++;
      continue;
    }
    if (c !== '*') continue;
    if (s[j + 1] === '*') {
      j++;
      continue;
    }
    return j;
  }
  return -1;
}

/** The first index at or after `from` where `s` holds a character that starts an inline construct, or -1. */
function nextSpecial(s, from) {
  let j = s.indexOf('\\', from);
  let k = s.indexOf('`', from);
  if (k !== -1 && (j === -1 || k < j)) j = k;
  k = s.indexOf('*', from);
  if (k !== -1 && (j === -1 || k < j)) j = k;
  k = s.indexOf('[', from);
  if (k !== -1 && (j === -1 || k < j)) j = k;
  return j;
}

/**
 * `s` rendered inline; `env.link(target)` is a link's href. Text with no
 * construct in it is escaped in one call; otherwise plain runs between
 * constructs are escaped in bulk, and a construct that does not close is left
 * as literal text, exactly as the reference leaves it.
 */
export function inline(s, env) {
  if (s.indexOf('\\') === -1 && s.indexOf('`') === -1 && s.indexOf('*') === -1 && s.indexOf('[') === -1) return escapeHtml(s);
  const out = [];
  let run = 0;
  let i = nextSpecial(s, 0);
  while (i !== -1) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && ESCAPABLE.has(s[i + 1])) {
      if (i > run) out.push(escapeHtml(s.slice(run, i)));
      out.push(escapeHtml(s[i + 1]));
      run = i + 2;
      i = nextSpecial(s, run);
      continue;
    }
    if (c === '\\') {
      // Not an escape: the backslash stays literal text.
      i = nextSpecial(s, i + 1);
      continue;
    }
    if (c === '`') {
      const j = s.indexOf('`', i + 1);
      if (j > i + 1) {
        if (i > run) out.push(escapeHtml(s.slice(run, i)));
        out.push('<code>', escapeHtml(s.slice(i + 1, j)), '</code>');
        run = j + 1;
        i = nextSpecial(s, run);
      } else {
        i = nextSpecial(s, i + 1);
      }
      continue;
    }
    if (c === '*') {
      if (s[i + 1] === '*') {
        const j = findUnescaped(s, '**', i + 2);
        if (j > i + 2) {
          if (i > run) out.push(escapeHtml(s.slice(run, i)));
          out.push('<strong>', inline(s.slice(i + 2, j), env), '</strong>');
          run = j + 2;
          i = nextSpecial(s, run);
        } else {
          i = nextSpecial(s, i + 2);
        }
        continue;
      }
      const j = findSingleStar(s, i + 1);
      if (j > i + 1) {
        if (i > run) out.push(escapeHtml(s.slice(run, i)));
        out.push('<em>', inline(s.slice(i + 1, j), env), '</em>');
        run = j + 1;
        i = nextSpecial(s, run);
      } else {
        i = nextSpecial(s, i + 1);
      }
      continue;
    }
    // '['
    const k = findUnescaped(s, ']', i + 1);
    const m = k !== -1 && s[k + 1] === '(' ? s.indexOf(')', k + 2) : -1;
    const target = m === -1 ? '' : s.slice(k + 2, m);
    if (target !== '' && !/\s/.test(target)) {
      if (i > run) out.push(escapeHtml(s.slice(run, i)));
      out.push('<a href="', escapeHtml(env.link(target)), '">', inline(s.slice(i + 1, k), env), '</a>');
      run = m + 1;
      i = nextSpecial(s, run);
      continue;
    }
    i = nextSpecial(s, i + 1);
  }
  if (s.length > run) out.push(escapeHtml(s.slice(run)));
  return out.join('');
}

/**
 * `src` rendered: its HTML (each block on its own lines, a "\n" after the last), its table of contents (every level 2
 * and 3 heading: level, id and its inline HTML) and its excerpt (the first paragraph's inline HTML, or "").
 */
export function renderMarkdown(src, env) {
  const ids = new Set();
  const blocks = [];
  const toc = [];
  let excerpt = null;
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const c0 = line[0];
    if (line === '') {
      i++;
      continue;
    }
    if (c0 === ' ' || c0 === '\t') {
      if (BLANK.test(line)) {
        i++;
        continue;
      }
      // Otherwise a paragraph line; fall through below.
    } else if (c0 === '`') {
      const fence = FENCE_OPEN.exec(line);
      if (fence !== null) {
        const body = [];
        i++;
        while (i < lines.length && !FENCE_CLOSE.test(lines[i])) body.push(lines[i++]);
        i++;
        const cls = fence[1] === '' ? '' : ` class="language-${escapeHtml(fence[1])}"`;
        blocks.push(`<pre><code${cls}>${body.map((l) => `${escapeHtml(l)}\n`).join('')}</code></pre>\n`);
        continue;
      }
      // Otherwise a paragraph line; fall through below.
    } else if (c0 === '#') {
      const heading = headingOf(line);
      if (heading !== null) {
        const id = uniqueSlug(slugify(heading.text), ids);
        const html = inline(heading.text, env);
        blocks.push(`<h${heading.depth} id="${id}">${html}</h${heading.depth}>\n`);
        if (heading.depth === 2 || heading.depth === 3) toc.push({ level: heading.depth, id, html });
        i++;
        continue;
      }
      // Otherwise a paragraph line; fall through below.
    } else if (c0 === '-' || c0 === '*') {
      if (HR.test(line)) {
        blocks.push('<hr>\n');
        i++;
        continue;
      }
      const bullet = BULLET.exec(line);
      if (bullet !== null) {
        const items = [];
        while (i < lines.length) {
          const m = BULLET.exec(lines[i]);
          if (m !== null) {
            items.push([trimLine(m[1])]);
            i++;
          } else if (CONTINUED.test(lines[i])) {
            items[items.length - 1].push(trimLine(lines[i]));
            i++;
          } else break;
        }
        blocks.push(`<ul>\n${items.map((parts) => `<li>${inline(parts.join('\n'), env)}</li>\n`).join('')}</ul>\n`);
        continue;
      }
      // Otherwise a paragraph line; fall through below.
    } else if (c0 === '>') {
      const body = [];
      while (i < lines.length && lines[i][0] === '>') body.push(lines[i][1] === ' ' ? lines[i++].slice(2) : lines[i++].slice(1));
      const inner = body.map(trimLine).filter((l) => l !== '');
      blocks.push(inner.length === 0 ? '<blockquote>\n</blockquote>\n' : `<blockquote>\n<p>${inline(inner.join('\n'), env)}</p>\n</blockquote>\n`);
      continue;
    } else if (c0 >= '0' && c0 <= '9') {
      const ordered = ORDERED.exec(line);
      if (ordered !== null) {
        const items = [];
        while (i < lines.length) {
          const m = ORDERED.exec(lines[i]);
          if (m !== null) {
            items.push([trimLine(m[2])]);
            i++;
          } else if (CONTINUED.test(lines[i])) {
            items[items.length - 1].push(trimLine(lines[i]));
            i++;
          } else break;
        }
        const start = Number(ordered[1]);
        const open = start !== 1 ? `<ol start="${start}">` : '<ol>';
        blocks.push(`${open}\n${items.map((parts) => `<li>${inline(parts.join('\n'), env)}</li>\n`).join('')}</ol>\n`);
        continue;
      }
      // Otherwise a paragraph line; fall through below.
    }
    const body = [trimLine(line)];
    i++;
    while (i < lines.length && !endsParagraph(lines[i])) body.push(trimLine(lines[i++]));
    const html = inline(body.join('\n'), env);
    if (excerpt === null) excerpt = html;
    blocks.push(`<p>${html}</p>\n`);
  }
  return { html: blocks.join(''), toc, excerpt: excerpt ?? '' };
}
