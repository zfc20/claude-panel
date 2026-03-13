# claude-panel

> Terminal split panel + agent marketplace for Claude Code

Left: Claude Code | Right: Live panel with skills, agents, context limit, git status.

## Install

```bash
npx claude-panel
```

That's it. Open a new terminal and type `claude`.

## What you get

```
┌─────────────────────────────┬──────────────────────────┐
│                             │  == CLAUDE CODE PANEL == │
│   claude (your session)     │  16:22  13.03.2026  [TR] │
│                             │  E:\my-project           │
│   > ask claude anything     │  ---------------------------------------- │
│                             │  CONTEXT / LIMIT         │
│                             │  [========............]   │
│                             │  72 KB / 40 KB (180%)    │
│                             │  !! LIMIT EXCEEDED       │
│                             │  ---------------------------------------- │
│                             │  GIT                     │
│                             │  Branch: master          │
│                             │  Pending: 3 files        │
│                             │  ---------------------------------------- │
│                             │  SKILLS (8)              │
│                             │   /docker-expert  Docker │
│                             │   /senior-backend Backend│
│                             │  ---------------------------------------- │
│                             │  AGENTS (35)             │
│                             │   golang-pro    Go expert│
│                             │   rust-pro      Rust ..  │
└─────────────────────────────┴──────────────────────────┘
```

## Marketplace

Browse and install 418+ agents interactively:

```bash
marketplace
```

```
  == CLAUDE CODE MARKETPLACE ==
  Kategori sec

    1. ai-specialists          8 agent
    2. api-graphql             8 agent
    3. development-team       17 agent
    4. development-tools      34 agent
    5. security               20 agent
   ...

  s = search  |  q = quit
```

Agents are installed via `npx claude-code-templates@latest --agent <category>/<name>`.

## Commands

| Command | What it does |
|---------|-------------|
| `claude` | Open Claude Code with live panel side by side |
| `marketplace` | Browse + install 418 agents interactively |
| `panel-lang tr` | Switch panel to Turkish |
| `panel-lang en` | Switch panel to English |

## Panel shows (live, refreshes every 30s)

- **CLAUDE.md context bar** — warns when over 40KB limit
- **Git status** — branch, pending files, last commit
- **Memory files** — count of `~/.claude/projects/.../memory/` files
- **Skills** — all installed skills with descriptions, call with `/`
- **Agents** — all installed agents with descriptions
- **Favorites** — pinned skills/agents at top

## Add to favorites

```powershell
panel-fav /docker-expert      # pin a skill
panel-fav golang-pro          # pin an agent
```

## Requirements

- Windows Terminal (`winget install Microsoft.WindowsTerminal`)
- Node.js 16+
- Claude Code (`npm install -g @anthropic-ai/claude-code`)

## Works from

- PowerShell ✓
- CMD ✓ (after install, new terminal needed)

