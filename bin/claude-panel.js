#!/usr/bin/env node
// claude-panel — setup + launcher
// Supports Windows (PowerShell + Windows Terminal) and macOS/Linux (tmux)

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { execSync } = require("child_process");

const HOME        = os.homedir();
const CLAUDE_DIR  = path.join(HOME, ".claude");
const IS_WIN      = process.platform === "win32";
const IS_MAC      = process.platform === "darwin";
const IS_LINUX    = process.platform === "linux";

// ── Dosya içerikleri ──────────────────────────────────────────────────────────

function getPanelPs1() {
  const cd = CLAUDE_DIR.replace(/\\/g, "\\\\");
  return `# claude-panel — terminal-panel.ps1 (Windows/PowerShell)
while ($true) {
    Clear-Host
    $claudeDir = "${cd}"
    $cwd       = (Get-Location).Path
    $timeStr   = Get-Date -Format "HH:mm  dd.MM.yyyy"

    function Get-Desc($f) {
        $line = Select-String -Path $f -Pattern '^description:' -CaseSensitive | Select-Object -First 1
        if (-not $line) { return "" }
        return $line.Line -replace '^description:[\\s]*','' -replace '^[|"'+"'"+']','' | ForEach-Object { $_.Trim() }
    }

    # CLAUDE.md
    $mdPath = @("$cwd\\CLAUDE.md") | Where-Object { Test-Path $_ } | Select-Object -First 1
    $mdBytes = if ($mdPath) { (Get-Item $mdPath).Length } else { 0 }
    $mdKB    = [math]::Round($mdBytes/1024,1)
    $mdPct   = [math]::Min([math]::Round($mdBytes/40000*100),999)
    $filled  = [math]::Min([math]::Round($mdPct/100*20),20)
    $bar     = ("=" * $filled) + ("." * (20-$filled))
    $mdColor = if ($mdPct -ge 100) {"Red"} elseif ($mdPct -ge 75) {"Yellow"} else {"Green"}

    # Git
    $branch = try { git -C $cwd branch --show-current 2>$null } catch { "?" }
    $gitN   = try { @(git -C $cwd status --porcelain 2>$null).Count } catch { 0 }
    $lastC  = try { git -C $cwd log -1 --format="%s" 2>$null } catch { "" }
    if ($lastC -and $lastC.Length -gt 38) { $lastC = $lastC.Substring(0,35) + "..." }

    # Memory
    $memN = 0
    if (Test-Path "$claudeDir\\projects") {
        $memN = @(Get-ChildItem "$claudeDir\\projects" -Filter "*.md" -Recurse -EA SilentlyContinue).Count
    }

    # Skills
    $skillList = @(Get-ChildItem "$claudeDir\\skills" -Directory -EA SilentlyContinue)
    # Agents
    $agentList = @(Get-ChildItem "$claudeDir\\agents" -Filter "*.md" -EA SilentlyContinue)

    # Favorites
    $favFile = "$claudeDir\\panel-favs.json"
    $favSkills = @(); $favAgents = @()
    if (Test-Path $favFile) {
        try {
            $fav = Get-Content $favFile | ConvertFrom-Json
            $favSkills = @($fav.skills)
            $favAgents = @($fav.agents)
        } catch {}
    }

    # Lang
    $langFile = "$claudeDir\\panel-config.json"
    $lang = "EN"
    if (Test-Path $langFile) {
        try { $lang = (Get-Content $langFile | ConvertFrom-Json).lang } catch {}
    }

    # ── Ekran ───────────────────────────────────────────────────────────────
    Write-Host ""
    Write-Host "  == CLAUDE CODE PANEL ==" -ForegroundColor Cyan
    Write-Host "  $timeStr  [$lang]" -ForegroundColor DarkGray
    Write-Host "  $($cwd.Substring(0,[math]::Min($cwd.Length,50)))" -ForegroundColor DarkGray
    Write-Host ("  " + "-"*50) -ForegroundColor DarkGray

    Write-Host ""
    Write-Host "  CONTEXT / LIMIT" -ForegroundColor Yellow
    Write-Host "  [$bar]  $mdKB KB / 40 KB  ($mdPct%)" -ForegroundColor $mdColor
    if ($mdPct -ge 100) { Write-Host "  !! LIMIT EXCEEDED" -ForegroundColor Red }
    if (-not $mdPath)   { Write-Host "  (no CLAUDE.md here)" -ForegroundColor DarkGray }

    Write-Host ""
    Write-Host ("  " + "-"*50) -ForegroundColor DarkGray
    Write-Host "  GIT & MEMORY" -ForegroundColor Yellow
    Write-Host "  Branch  : $branch" -ForegroundColor Blue
    if ($gitN -gt 0) { Write-Host "  Changed : $gitN files" -ForegroundColor Yellow }
    else             { Write-Host "  Git     : clean" -ForegroundColor Green }
    if ($lastC) { Write-Host "  Last    : $lastC" -ForegroundColor DarkGray }
    Write-Host "  Memory  : $memN files" -ForegroundColor Gray

    Write-Host ""
    Write-Host ("  " + "-"*50) -ForegroundColor DarkGray
    Write-Host "  SKILLS ($($skillList.Count))  -- call with /" -ForegroundColor Blue
    foreach ($fav in $favSkills) { if ($fav) { Write-Host "  * /$fav" -ForegroundColor Cyan } }
    foreach ($sk in $skillList)  {
        if ($favSkills -notcontains $sk.Name) { Write-Host "  /$($sk.Name)" -ForegroundColor Cyan }
    }

    Write-Host ""
    Write-Host ("  " + "-"*50) -ForegroundColor DarkGray
    Write-Host "  AGENTS ($($agentList.Count))" -ForegroundColor Green
    foreach ($fav in $favAgents) { if ($fav) { Write-Host "  * $fav" -ForegroundColor Green } }
    foreach ($ag in $agentList) {
        if ($favAgents -notcontains $ag.BaseName) {
            $desc = Get-Desc $ag.FullName
            $name = $ag.BaseName.PadRight(22)
            if ($desc) { $desc = if ($desc.Length -gt 26) { $desc.Substring(0,23)+"..." } else { $desc } }
            Write-Host "  $name " -NoNewline -ForegroundColor Green
            Write-Host $desc -ForegroundColor DarkGray
        }
    }

    Write-Host ""
    Write-Host ("  " + "-"*50) -ForegroundColor DarkGray
    Write-Host "  $timeStr  (30s refresh)  Ctrl+C to close" -ForegroundColor DarkGray
    Start-Sleep 30
}
`.trim();
}

function getClaudeCmd(claudePath) {
  const ps1 = path.join(CLAUDE_DIR, "terminal-panel.ps1");
  return `@echo off
wt new-tab --title "Claude Code" --startingDirectory "%CD%" powershell.exe -NoExit -Command "& '${claudePath}'" ; split-pane --size 0.30 --title "Panel" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${ps1}"
`;
}

// Mac/Linux: fonksiyonlar ~/.zshrc veya ~/.bashrc'ye eklenir
function getMacProfileBlock() {
  const panel = path.join(CLAUDE_DIR, "panel.sh");
  const mkt   = path.join(CLAUDE_DIR, "marketplace.js");
  return `
# claude-panel-start
function claude() {
  local PANEL="$HOME/.claude/panel.sh"
  if command -v tmux &>/dev/null && [ -f "$PANEL" ] && [ -z "$TMUX" ]; then
    tmux new-session \\; \\
      send-keys "command claude" C-m \\; \\
      split-window -h -p 30 \\; \\
      send-keys "bash '$PANEL'" C-m \\; \\
      select-pane -t 0
  else
    command claude "$@"
  fi
}
function marketplace() { node "${mkt}" "$@"; }
function panel-lang() {
  local CFG="$HOME/.claude/panel-config.json"
  local LANG="EN"
  [ "$1" = "tr" ] || [ "$1" = "TR" ] && LANG="TR"
  [ "$1" = "en" ] || [ "$1" = "EN" ] && LANG="EN"
  echo '{"lang":"'"$LANG"'"}' > "$CFG"
  echo "Panel dili: $LANG"
}
function panel-fav() {
  local FAV="$HOME/.claude/panel-favs.json"
  [ -f "$FAV" ] || echo '{"skills":[],"agents":[]}' > "$FAV"
  node -e "
    const f='$FAV', a='$1';
    const d=JSON.parse(require('fs').readFileSync(f,'utf8'));
    if(a.startsWith('/')) {
      const k=a.slice(1);
      if(!d.skills.includes(k)) d.skills.push(k);
    } else {
      if(!d.agents.includes(a)) d.agents.push(a);
    }
    require('fs').writeFileSync(f,JSON.stringify(d,null,2));
    console.log('Favoriye eklendi:',a);
  "
}
# claude-panel-end
`;
}

// ── Windows kurulum ────────────────────────────────────────────────────────────
function installWindows() {
  console.log("\n⚡ claude-panel kurulum — Windows\n");

  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  // terminal-panel.ps1
  const ps1Path = path.join(CLAUDE_DIR, "terminal-panel.ps1");
  fs.writeFileSync(ps1Path, getPanelPs1(), "utf8");
  console.log("  OK  terminal-panel.ps1 →", ps1Path);

  // marketplace.js
  const mkSrc = path.join(__dirname, "..", "scripts", "marketplace.js");
  const mkDst = path.join(CLAUDE_DIR, "marketplace.js");
  if (fs.existsSync(mkSrc)) {
    fs.copyFileSync(mkSrc, mkDst);
    console.log("  OK  marketplace.js →", mkDst);
  }

  // claude.cmd — PATH'e eklenen dizin
  let claudePath = "claude";
  try { claudePath = execSync("where claude.cmd", { encoding: "utf8" }).trim().split("\n")[0].trim(); } catch {}
  const cmdPath = path.join(CLAUDE_DIR, "claude.cmd");
  fs.writeFileSync(cmdPath, getClaudeCmd(claudePath), "utf8");
  console.log("  OK  claude.cmd →", cmdPath);

  // PATH: ~/.claude ekle (kalıcı olarak, user scope)
  try {
    const currentPath = execSync(
      'powershell -Command "[Environment]::GetEnvironmentVariable(\'PATH\',\'User\')"',
      { encoding: "utf8" }
    ).trim();
    if (!currentPath.includes(CLAUDE_DIR)) {
      const newPath = CLAUDE_DIR + ";" + currentPath;
      execSync(
        `powershell -Command "[Environment]::SetEnvironmentVariable('PATH','${newPath}','User')"`,
        { stdio: "inherit" }
      );
      console.log("  OK  PATH güncellendi — ~/.claude eklendi");
    } else {
      console.log("  --  PATH zaten içeriyor ~/.claude");
    }
  } catch { console.log("  !!  PATH güncellenemedi — manuel ekle:", CLAUDE_DIR); }

  // PowerShell profile — claude + marketplace fonksiyonları
  const profileFuncs = `
# claude-panel-start
function claude {
    param([Parameter(ValueFromRemainingArguments)][string[]]$passArgs)
    $ps1  = "${path.join(CLAUDE_DIR, "terminal-panel.ps1").replace(/\\/g, "\\\\")}"
    $real = "${claudePath.replace(/\\/g, "\\\\")}"
    $cwd  = (Get-Location).Path
    wt new-tab --title "Claude Code" --startingDirectory "$cwd" powershell.exe -NoExit -Command "& '$real'" ; split-pane --size 0.30 --title "Panel" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps1"
}
function marketplace { node "${path.join(CLAUDE_DIR, "marketplace.js").replace(/\\/g, "\\\\")}" @args }
function panel-lang {
    param($l)
    $cfg = "${path.join(CLAUDE_DIR, "panel-config.json").replace(/\\/g, "\\\\")}";
    $code = if ($l -eq "tr" -or $l -eq "TR") {"TR"} else {"EN"}
    Set-Content $cfg "{\\"lang\\":\\"$code\\"}" -Encoding UTF8
    Write-Host "Panel dili: $code"
}
function panel-fav {
    param($item)
    $fav = "${path.join(CLAUDE_DIR, "panel-favs.json").replace(/\\/g, "\\\\")}";
    node -e "const f='$fav',a='$item';const d=JSON.parse(require('fs').readFileSync(f,'utf8'));if(a.startsWith('/')){const k=a.slice(1);if(!d.skills.includes(k))d.skills.push(k);}else{if(!d.agents.includes(a))d.agents.push(a);}require('fs').writeFileSync(f,JSON.stringify(d,null,2));console.log('Favoriye eklendi:',a);"
}
# claude-panel-end
`;

  const profPath = execSync(
    'powershell -Command "echo $PROFILE"',
    { encoding: "utf8" }
  ).trim();

  let existing = "";
  if (fs.existsSync(profPath)) existing = fs.readFileSync(profPath, "utf8");
  // Önce eski bloğu temizle
  existing = existing.replace(/\n?# claude-panel-start[\s\S]*?# claude-panel-end\n?/g, "").trim();
  fs.mkdirSync(path.dirname(profPath), { recursive: true });
  fs.writeFileSync(profPath, existing + "\n" + profileFuncs, "utf8");
  console.log("  OK  PowerShell profile güncellendi →", profPath);

  // panel-favs.json (yoksa oluştur)
  const favPath = path.join(CLAUDE_DIR, "panel-favs.json");
  if (!fs.existsSync(favPath)) fs.writeFileSync(favPath, '{"skills":[],"agents":[]}', "utf8");

  console.log("\n✅ Kurulum tamamlandı!\n");
  console.log("  Yeni bir terminal aç ve 'claude' yaz.\n");
  console.log("  Komutlar:");
  console.log("    claude          — Claude + canlı panel (split)");
  console.log("    marketplace     — 418+ agent marketplace");
  console.log("    panel-lang tr   — Türkçe panel");
  console.log("    panel-lang en   — English panel");
  console.log("    panel-fav /skill-name  — skili favoriye ekle");
  console.log("    panel-fav agent-name   — agenti favoriye ekle\n");
}

// ── Mac / Linux kurulum ────────────────────────────────────────────────────────
function installMac() {
  console.log(`\n⚡ claude-panel kurulum — ${IS_MAC ? "macOS" : "Linux"}\n`);

  // Tmux kontrolü
  let hasTmux = false;
  try { execSync("tmux -V", { stdio: "ignore" }); hasTmux = true; } catch {}
  if (!hasTmux) {
    console.log("  !!  tmux bulunamadı. Kurulum:");
    if (IS_MAC)   console.log("      brew install tmux");
    if (IS_LINUX) console.log("      sudo apt install tmux  (veya dnf / pacman)");
    console.log("  Tmux kurulduktan sonra tekrar çalıştır: npx claude-panel\n");
    process.exit(1);
  }

  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  // panel.sh kopyala
  const shSrc = path.join(__dirname, "..", "scripts", "panel.sh");
  const shDst = path.join(CLAUDE_DIR, "panel.sh");
  if (fs.existsSync(shSrc)) {
    fs.copyFileSync(shSrc, shDst);
    fs.chmodSync(shDst, 0o755);
    console.log("  OK  panel.sh →", shDst);
  } else {
    console.log("  !!  panel.sh bulunamadı:", shSrc);
    process.exit(1);
  }

  // marketplace.js kopyala
  const mkSrc = path.join(__dirname, "..", "scripts", "marketplace.js");
  const mkDst = path.join(CLAUDE_DIR, "marketplace.js");
  if (fs.existsSync(mkSrc)) {
    fs.copyFileSync(mkSrc, mkDst);
    console.log("  OK  marketplace.js →", mkDst);
  }

  // panel-favs.json
  const favPath = path.join(CLAUDE_DIR, "panel-favs.json");
  if (!fs.existsSync(favPath)) fs.writeFileSync(favPath, '{"skills":[],"agents":[]}', "utf8");

  // Shell profile seç: zsh önce, sonra bash
  let profilePath = path.join(HOME, ".zshrc");
  if (!IS_MAC && !fs.existsSync(profilePath)) profilePath = path.join(HOME, ".bashrc");

  let existing = "";
  if (fs.existsSync(profilePath)) existing = fs.readFileSync(profilePath, "utf8");
  // Eski bloğu temizle
  existing = existing.replace(/\n?# claude-panel-start[\s\S]*?# claude-panel-end\n?/g, "").trim();
  fs.writeFileSync(profilePath, existing + "\n" + getMacProfileBlock(), "utf8");
  console.log("  OK  shell profile güncellendi →", profilePath);

  console.log("\n✅ Kurulum tamamlandı!\n");
  console.log("  Profili yükle:");
  console.log(`    source ${profilePath}\n`);
  console.log("  Sonra 'claude' yaz — tmux'ta split açılır.\n");
  console.log("  Komutlar:");
  console.log("    claude          — Claude + canlı panel (tmux split)");
  console.log("    marketplace     — 418+ agent marketplace");
  console.log("    panel-lang tr   — Türkçe panel");
  console.log("    panel-lang en   — English panel");
  console.log("    panel-fav /skill-name  — skili favoriye ekle");
  console.log("    panel-fav agent-name   — agenti favoriye ekle\n");
}

// ── Giriş noktası ─────────────────────────────────────────────────────────────
if (IS_WIN)          installWindows();
else if (IS_MAC || IS_LINUX) installMac();
else {
  console.log("Desteklenmeyen platform:", process.platform);
  process.exit(1);
}
