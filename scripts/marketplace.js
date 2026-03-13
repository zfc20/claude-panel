#!/usr/bin/env node
// Claude Code Marketplace — Terminal arayüzü
// Kullanim: node marketplace.js

const https  = require('https');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const REPO    = 'davila7/claude-code-templates';
const BASE    = `cli-tool/components/agents`;
const CACHE_F = path.join(os.homedir(), '.claude', 'marketplace-cache.json');

// ── Renk ──────────────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',  bold:  '\x1b[1m',
  cyan:    '\x1b[36m', blue:  '\x1b[34m',
  green:   '\x1b[32m', yellow:'\x1b[33m',
  red:     '\x1b[31m', gray:  '\x1b[90m',
  magenta: '\x1b[35m', white: '\x1b[97m',
};
const c = (color, text) => `${C[color]}${text}${C.reset}`;

// ── HTTP GET ───────────────────────────────────────────────────────────────
function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'claude-panel' } }, r => {
      let d = '';
      r.on('data', ch => d += ch);
      r.on('end', () => {
        try { res(JSON.parse(d)); } catch { res(d); }
      });
    }).on('error', rej);
  });
}

// ── Kategori listesi ───────────────────────────────────────────────────────
async function getCategories(useCache = true) {
  if (useCache && fs.existsSync(CACHE_F)) {
    const age = Date.now() - fs.statSync(CACHE_F).mtimeMs;
    if (age < 3600000) return JSON.parse(fs.readFileSync(CACHE_F, 'utf8'));
  }
  process.stdout.write(c('gray', '  Marketplace yuklenıyor...\r'));
  const tree = await get(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`);
  const agents = tree.tree.filter(x =>
    x.path.startsWith(`${BASE}/`) && x.path.endsWith('.md') && x.path.split('/').length === 5
  );
  const cats = {};
  agents.forEach(x => {
    const parts = x.path.split('/');
    const cat  = parts[3];
    const name = parts[4].replace('.md', '');
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push({ name, path: x.path });
  });
  fs.writeFileSync(CACHE_F, JSON.stringify(cats, null, 2));
  return cats;
}

// ── Frontmatter desc ──────────────────────────────────────────────────────
async function getDesc(filePath) {
  try {
    const raw = await get(`https://raw.githubusercontent.com/${REPO}/main/${filePath}`);
    const m = String(raw).match(/^description:\s*(.+)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, '').replace(/^\|/, '').trim() : '';
  } catch { return ''; }
}

// ── Kurulum ────────────────────────────────────────────────────────────────
function install(category, agentName) {
  const slug = `${category}/${agentName}`;
  console.log('\n' + c('cyan', `  Kuruluyor: ${slug}`));
  console.log(c('gray',  `  npx claude-code-templates@latest --agent ${slug}\n`));
  try {
    execSync(`npx claude-code-templates@latest --agent ${slug}`, { stdio: 'inherit' });
    console.log('\n' + c('green', `  ✓ Kuruldu: ${agentName}`));
  } catch {
    console.log('\n' + c('red', `  ✗ Kurulum basarisiz`));
  }
}

// ── Arayüz ────────────────────────────────────────────────────────────────
function clear() { process.stdout.write('\x1bc'); }

function printHeader(title) {
  clear();
  console.log('');
  console.log(c('cyan',  '  ══════════════════════════════════════════════════'));
  console.log(c('cyan',  `  ⚡ CLAUDE CODE MARKETPLACE`));
  console.log(c('gray',  `     ${title}`));
  console.log(c('cyan',  '  ══════════════════════════════════════════════════'));
  console.log('');
}

async function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(prompt, ans => { rl.close(); res(ans.trim()); }));
}

// ── Kategori ekranı ────────────────────────────────────────────────────────
async function showCategories(cats) {
  printHeader('Kategori sec');
  const catList = Object.entries(cats).sort(([a],[b]) => a.localeCompare(b));
  catList.forEach(([cat, agents], i) => {
    const num = String(i + 1).padStart(3);
    console.log(c('blue', `  ${num}.`) + ` ${c('white', cat.padEnd(30))} ${c('gray', agents.length + ' agent')}`);
  });
  console.log('');
  console.log(c('gray', '  s = ara  |  q = cik  |  r = yenile'));
  console.log('');
  const ans = await ask(c('yellow', '  Secim: '));
  if (ans === 'q') process.exit(0);
  if (ans === 'r') { fs.rmSync(CACHE_F, { force: true }); return showCategories(await getCategories(false)); }
  if (ans === 's') return searchMode(cats);
  const idx = parseInt(ans) - 1;
  if (idx >= 0 && idx < catList.length) {
    await showAgents(catList[idx][0], catList[idx][1], cats);
  } else {
    await showCategories(cats);
  }
}

// ── Agent ekranı ──────────────────────────────────────────────────────────
async function showAgents(cat, agents, cats) {
  printHeader(`${cat}  (${agents.length} agent)`);
  agents.forEach((ag, i) => {
    const num   = String(i + 1).padStart(3);
    const installed = isInstalled(ag.name);
    const mark  = installed ? c('green', ' ✓') : '  ';
    console.log(c('green', `  ${num}.`) + mark + ` ${c('white', ag.name)}`);
  });
  console.log('');
  console.log(c('gray', '  Numara = detay/kur  |  b = geri  |  s = ara'));
  console.log('');
  const ans = await ask(c('yellow', '  Secim: '));
  if (ans === 'b') return showCategories(cats);
  if (ans === 's') return searchMode(cats);
  const idx = parseInt(ans) - 1;
  if (idx >= 0 && idx < agents.length) {
    await showAgentDetail(cat, agents[idx], agents, cats);
  } else {
    await showAgents(cat, agents, cats);
  }
}

// ── Agent detay ───────────────────────────────────────────────────────────
async function showAgentDetail(cat, agent, agents, cats) {
  printHeader(`${cat} / ${agent.name}`);
  process.stdout.write(c('gray', '  Aciklama yukleniyor...\r'));
  const desc = await getDesc(agent.path);
  console.log(c('white', `  Agent : `) + c('cyan', agent.name));
  console.log(c('white', `  Kategori: `) + c('blue', cat));
  if (desc) console.log(c('white', `  Aciklama:\n`) + c('gray', '    ') + c('gray', desc.substring(0, 200)));
  const installed = isInstalled(agent.name);
  console.log('');
  if (installed) {
    console.log(c('green', `  ✓ Zaten kurulu: ~/.claude/agents/${agent.name}.md`));
  } else {
    console.log(c('gray', `  Kurulum: npx claude-code-templates@latest --agent ${cat}/${agent.name}`));
  }
  console.log('');
  console.log(c('gray', `  k = kur  |  b = geri  |  q = cik`));
  console.log('');
  const ans = await ask(c('yellow', '  Secim: '));
  if (ans === 'k') {
    if (!installed) install(cat, agent.name);
    else console.log(c('yellow', '  Zaten kurulu, atlanıyor.'));
    await ask(c('gray', '  Enter ile devam...'));
    await showAgents(cat, agents, cats);
  } else if (ans === 'b') {
    await showAgents(cat, agents, cats);
  } else if (ans === 'q') {
    process.exit(0);
  } else {
    await showAgentDetail(cat, agent, agents, cats);
  }
}

// ── Arama ─────────────────────────────────────────────────────────────────
async function searchMode(cats) {
  printHeader('Ara');
  const q = await ask(c('yellow', '  Arama (agent adi): '));
  if (!q) return showCategories(cats);
  const results = [];
  Object.entries(cats).forEach(([cat, agents]) => {
    agents.forEach(ag => {
      if (ag.name.includes(q.toLowerCase())) results.push({ cat, ag });
    });
  });
  printHeader(`Arama: "${q}"  (${results.length} sonuc)`);
  if (results.length === 0) {
    console.log(c('red', '  Sonuc bulunamadi.'));
    await ask(c('gray', '  Enter ile geri...'));
    return showCategories(cats);
  }
  results.slice(0, 30).forEach((r, i) => {
    const inst = isInstalled(r.ag.name);
    const mark = inst ? c('green', ' ✓') : '  ';
    console.log(c('green', `  ${String(i+1).padStart(3)}.`) + mark + ` ${c('white', r.ag.name.padEnd(30))} ${c('gray', r.cat)}`);
  });
  console.log('');
  const ans = await ask(c('yellow', '  Numara sec veya b=geri: '));
  if (ans === 'b') return showCategories(cats);
  const idx = parseInt(ans) - 1;
  if (idx >= 0 && idx < results.length) {
    const { cat, ag } = results[idx];
    await showAgentDetail(cat, ag, cats[cat], cats);
  } else {
    await showCategories(cats);
  }
}

// ── Kurulu mu kontrol ─────────────────────────────────────────────────────
function isInstalled(name) {
  const p = path.join(os.homedir(), '.claude', 'agents', `${name}.md`);
  return fs.existsSync(p);
}

// ── Başlat ────────────────────────────────────────────────────────────────
(async () => {
  try {
    const cats = await getCategories();
    await showCategories(cats);
  } catch (e) {
    console.error(c('red', '  Hata: ' + e.message));
    console.error(c('gray', '  Internet baglantinizi kontrol edin.'));
    process.exit(1);
  }
})();
