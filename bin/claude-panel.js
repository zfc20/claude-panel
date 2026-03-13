#!/usr/bin/env node

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { execSync, spawn } = require("child_process");

const HOME       = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const IS_WIN     = process.platform === "win32";
const INSTALL    = process.argv.includes("--install");
const OPEN       = process.argv.includes("--open") || process.argv.length === 2;

// ─── Dosya içerikleri ──────────────────────────────────────────────────────

function getPanelScript() {
  return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Name Win32 -Namespace Utils -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int h2, bool r);
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
'@

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$hwnd = [Utils.Win32]::GetConsoleWindow()
[Utils.Win32]::MoveWindow($hwnd, ($screen.Width - 440), 0, 440, $screen.Height, $true) | Out-Null
$host.UI.RawUI.WindowTitle = "Claude Code Panel"
try {
    $host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(55, 9999)
    $host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(55, 80)
} catch {}

while ($true) {
    Clear-Host
    $claudeDir = "${CLAUDE_DIR.replace(/\\/g, "\\\\")}"
    $cwd = (Get-Location).Path
    $timeStr = Get-Date -Format "HH:mm:ss  dd.MM.yyyy"

    # CLAUDE.md — once proje dizininde ara, sonra cwd'de
    $mdPath = $null
    @("$cwd\\CLAUDE.md", (Join-Path $cwd "CLAUDE.md")) | ForEach-Object {
        if ((Test-Path $_) -and -not $mdPath) { $mdPath = $_ }
    }
    $mdBytes = if ($mdPath) { (Get-Item $mdPath).Length } else { 0 }
    $mdKB = [math]::Round($mdBytes / 1024, 1)
    $mdPct = [math]::Min([math]::Round($mdBytes / 40000 * 100), 999)
    $filled = [math]::Min([math]::Round($mdPct / 100 * 20), 20)
    $bar = ("=" * $filled) + ("." * (20 - $filled))
    $mdColor = if ($mdPct -ge 100) { "Red" } elseif ($mdPct -ge 75) { "Yellow" } else { "Green" }

    $skillList = @(Get-ChildItem "$claudeDir\\skills" -Directory -EA SilentlyContinue)
    $agentList = @(Get-ChildItem "$claudeDir\\agents" -Filter "*.md" -EA SilentlyContinue)

    $memDir = "$claudeDir\\projects"
    $memN = 0
    if (Test-Path $memDir) {
        $memN = @(Get-ChildItem $memDir -Filter "*.md" -Recurse -EA SilentlyContinue).Count
    }

    $branch = try { git -C $cwd branch --show-current 2>$null } catch { "?" }
    $gitN   = try { @(git -C $cwd status --porcelain 2>$null).Count } catch { 0 }
    $lastC  = try { git -C $cwd log -1 --format="%s" 2>$null } catch { "" }
    if ($lastC -and $lastC.Length -gt 38) { $lastC = $lastC.Substring(0, 35) + "..." }

    Write-Host ""
    Write-Host "  == CLAUDE CODE PANEL ==" -ForegroundColor Cyan
    Write-Host "  $timeStr" -ForegroundColor DarkGray
    Write-Host "  $cwd" -ForegroundColor DarkGray
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray

    Write-Host ""
    Write-Host "  CONTEXT / LIMIT" -ForegroundColor Yellow
    Write-Host "  CLAUDE.md  [$bar]  $mdKB KB / 40 KB  ($mdPct%)" -ForegroundColor $mdColor
    if ($mdPct -ge 100) { Write-Host "  !! LIMIT ASILDI" -ForegroundColor Red }
    if (-not $mdPath) { Write-Host "  (bu dizinde CLAUDE.md yok)" -ForegroundColor DarkGray }

    Write-Host ""
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray
    Write-Host "  GIT & HAFIZA" -ForegroundColor Yellow
    Write-Host "  Branch   : $branch" -ForegroundColor Blue
    if ($gitN -gt 0) { Write-Host "  Degisik  : $gitN dosya" -ForegroundColor Yellow }
    else { Write-Host "  Git      : temiz" -ForegroundColor Green }
    if ($lastC) { Write-Host "  Son commit: $lastC" -ForegroundColor DarkGray }
    Write-Host "  Memory   : $memN dosya" -ForegroundColor Gray

    Write-Host ""
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray
    Write-Host "  SKILLS ($($skillList.Count))  -- / ile cagir" -ForegroundColor Blue
    foreach ($sk in $skillList) { Write-Host "  /$($sk.Name)" -ForegroundColor Cyan }

    Write-Host ""
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray
    Write-Host "  AGENTS ($($agentList.Count))" -ForegroundColor Green
    $i = 0
    foreach ($ag in $agentList) {
        if ($i % 2 -eq 0) { Write-Host -NoNewline "  " }
        Write-Host -NoNewline $ag.BaseName.PadRight(26) -ForegroundColor Green
        $i++
        if ($i % 2 -eq 0) { Write-Host "" }
    }
    if ($i % 2 -ne 0) { Write-Host "" }

    Write-Host ""
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray
    Write-Host "  $timeStr  (30sn)  Ctrl+C=kapat" -ForegroundColor DarkGray
    Start-Sleep 30
}
`.trim();
}

function getWrapperBat(claudePath) {
  return `@echo off
wt new-tab --title "Claude Code" --startingDirectory "%CD%" cmd /k "${claudePath}" ; split-pane --size 0.30 --title "Panel" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${path.join(CLAUDE_DIR, "terminal-panel.ps1")}"
`;
}

// ─── Kurulum ───────────────────────────────────────────────────────────────

function install() {
  console.log("\n⚡ Claude Panel kuruluyor...\n");

  // ~/.claude dizini
  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });

  // panel.ps1 yaz
  const ps1Path = path.join(CLAUDE_DIR, "terminal-panel.ps1");
  fs.writeFileSync(ps1Path, getPanelScript(), "utf8");
  console.log("✅ terminal-panel.ps1 yazıldı →", ps1Path);

  if (!IS_WIN) {
    console.log("ℹ️  Windows dışı platform — .bat oluşturulmadı.");
    console.log("   Panel scripti:", ps1Path);
    return;
  }

  // claude.cmd yolunu bul
  let claudePath = "claude";
  try { claudePath = execSync("where claude.cmd", { encoding: "utf8" }).trim().split("\n")[0].trim(); } catch {}

  // claude-ac.bat yaz (proje dizinine CD ederek açar)
  const batPath = path.join(CLAUDE_DIR, "claude-ac.bat");
  fs.writeFileSync(batPath, getWrapperBat(claudePath), "utf8");
  console.log("✅ claude-ac.bat yazıldı →", batPath);

  // claude-panel.bat — PATH'e ekli bir wrapper (global komut)
  const wrapperPath = path.join(CLAUDE_DIR, "claude-panel.bat");
  fs.writeFileSync(wrapperPath, getWrapperBat(claudePath), "utf8");

  console.log("\n✅ Kurulum tamamlandı!\n");
  console.log("  Kullanım:");
  console.log("  1. Proje klasörüne gir");
  console.log("  2. Çift tıkla →", batPath);
  console.log("     VEYA terminalde: claude-ac");
  console.log("\n  Sol: Claude Code | Sağ: Canlı panel\n");
}

// ─── Aç ───────────────────────────────────────────────────────────────────

function open() {
  const batPath = path.join(CLAUDE_DIR, "claude-ac.bat");
  if (!fs.existsSync(batPath)) {
    console.log("Panel bulunamadı. Önce kur: npx claude-panel --install");
    process.exit(1);
  }
  console.log("⚡ Açılıyor...");
  spawn("cmd.exe", ["/c", "start", "", batPath], { detached: true, stdio: "ignore" }).unref();
}

// ─── Giriş noktası ────────────────────────────────────────────────────────

if (INSTALL) {
  install();
} else if (OPEN) {
  // Hem kur hem aç
  install();
  setTimeout(open, 500);
}
