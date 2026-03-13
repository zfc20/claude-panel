# ⚡ claude-panel

> **Terminal split panel + agent marketplace for Claude Code**

Stop working blind. See your context limit, git status, and every installed skill/agent — live, right next to Claude.

```
┌──────────────────────────────────┬──────────────────────────────┐
│                                  │  ⚡ CLAUDE CODE PANEL         │
│   claude (your session)          │  16:22  13.03.2026  [TR]     │
│                                  │  E:\my-project               │
│   > ask claude anything          │  ──────────────────────────  │
│                                  │  CONTEXT / LIMIT             │
│                                  │  [========............]       │
│                                  │  72 KB / 40 KB (180%)        │
│                                  │  !! LIMIT EXCEEDED           │
│                                  │  ──────────────────────────  │
│                                  │  GIT  branch: master         │
│                                  │  Pending: 3 files            │
│                                  │  ──────────────────────────  │
│                                  │  SKILLS (8)                  │
│                                  │  ★ /docker-expert   Docker   │
│                                  │    /senior-backend  Backend  │
│                                  │  ──────────────────────────  │
│                                  │  AGENTS (35)                 │
│                                  │    golang-pro   Go expert    │
│                                  │    rust-pro     Rust/systems │
└──────────────────────────────────┴──────────────────────────────┘
```

## Install

```bash
npx claude-panel
```

Open a new terminal. Type `claude`. Done.

---

## What's in the panel

| Section | What it shows |
|---------|--------------|
| **CONTEXT** | CLAUDE.md size vs 40 KB limit — turns red when exceeded |
| **GIT** | Branch, pending files, last commit message |
| **MEMORY** | How many memory files are saved in `~/.claude/.../memory/` |
| **SKILLS** | All installed skills — invoke with `/skill-name` |
| **AGENTS** | All installed agents with one-line descriptions |
| **FAVORITES** | Pinned items (★) shown first |

Panel refreshes every 30 seconds automatically.

---

## Agent Marketplace

418 agents. 28 categories. Pick, preview, install — without leaving the terminal.

```bash
marketplace
```

```
  ⚡ CLAUDE CODE MARKETPLACE
  Kategori sec

    1. ai-specialists          8 agent
    2. api-graphql             8 agent
    3. development-team       17 agent
    4. development-tools      34 agent
    5. security               20 agent
    ...28 categories total

  s = ara  |  q = cik  |  r = yenile
```

Select a category → browse agents → read description → press `k` to install.
Already installed agents show `✓`.

Agents are installed via:
```bash
npx claude-code-templates@latest --agent <category>/<name>
```

---

## Commands

| Command | What it does |
|---------|-------------|
| `claude` | Open Claude Code with live panel side by side |
| `marketplace` | Browse + install 418+ agents interactively |
| `panel-lang tr` | Switch panel to Turkish |
| `panel-lang en` | Switch panel to English |
| `panel-fav /skill-name` | Pin a skill to top of panel |
| `panel-fav agent-name` | Pin an agent to top of panel |

---

## Requirements

- **Windows Terminal** — `winget install Microsoft.WindowsTerminal`
- **Node.js 16+**
- **Claude Code** — `npm install -g @anthropic-ai/claude-code`

Works from PowerShell and CMD.

---

## How it works

`npx claude-panel` does a one-time setup:

1. Installs `terminal-panel.ps1` → `~/.claude/`
2. Adds `claude` + `marketplace` functions to your PowerShell `$PROFILE`
3. Creates `~/.claude/claude.cmd` so it also works from CMD

After that, `claude` always opens a split terminal — your session on the left, the live panel on the right.

---

<p align="center">Built for Claude Code power users — runs entirely in your terminal.</p>
