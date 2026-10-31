// Run from the project root:  node apply_theme.mjs
// Swaps StudyHub's green/yellow palette for dark blue, turquoise and beige. Safe to run twice.
import fs from 'node:fs';
import path from 'node:path';

const MAP = {
  '#081C15': '#0A1F44', '#1B4322': '#12315F', '#0f2b1a': '#0A1F44', '#038666': '#0B8A94', '#FBB02D': '#2EC4B6',
  '#EBF2FA': '#F5EFE6', '#355E3B': '#12315F', '#4a7c52': '#1E4E8C', '#2a4a2f': '#0E2A55', '#1d3321': '#0A1F44',
  '#d6e5d9': '#D6E0EF', '#eef4ef': '#EEF3FA', '#dbe7e0': '#DCE5F0', '#9fc3b4': '#B8C4D9', '#4b5f55': '#4A5568',
  '#b8cdc3': '#CDBFA6', '#3f6a46': '#183F73',
};
const RGBA = [['rgba(3, 134, 102', 'rgba(11, 138, 148'], ['rgba(8, 28, 21', 'rgba(10, 31, 68'],
  ['rgba(235, 242, 250', 'rgba(245, 239, 230'], ['rgba(251, 176, 45', 'rgba(46, 196, 182'], ['rgba(27, 67, 34', 'rgba(18, 49, 95']];
const HEADER = `/*\n  StudyHub student theme: dark blue (#0A1F44 / #12315F), turquoise (#0B8A94 / #2EC4B6) and beige (#F5EFE6).\n  Applies only inside the student layout (the root <div> that has the class "sh-student").\n*/\n.sh-student { background: #0A1F44 !important; color: #F5EFE6; }\n`;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    e.isDirectory() ? walk(p, out) : /\.(jsx|js|css)$/.test(e.name) && e.name !== 'Stars.jsx' && out.push(p);
  }
  return out;
}
let changed = 0;
for (const f of [...walk('resources'), 'tailwind.config.js']) {
  if (!fs.existsSync(f)) continue;
  const before = fs.readFileSync(f, 'utf8');
  let s = before;
  if (path.basename(f) === 'studyhub-theme.css' && !s.includes('dark blue (#0A1F44')) {
    s = s.replace(/^\/\*[\s\S]*?\*\/\r?\n(\.sh-student \{[^}]*\}\r?\n)?/, HEADER);
  }
  for (const [a, b] of Object.entries(MAP)) s = s.replace(new RegExp(a.replace('#', '\\#'), 'gi'), b);
  for (const [a, b] of RGBA) s = s.split(a).join(b);
  if (s !== before) { fs.writeFileSync(f, s); changed++; }
}
console.log(`Theme applied to ${changed} files.`);
