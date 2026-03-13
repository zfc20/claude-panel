#!/usr/bin/env bash
# claude-panel — terminal panel for Claude Code (Mac / Linux)
# Runs as the right pane in a tmux split.

CLAUDE_DIR="$HOME/.claude"
INTERVAL=30

# ── ANSI renkleri ─────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; YELLOW='\033[0;33m'; GREEN='\033[0;32m'
BLUE='\033[0;34m'; RED='\033[0;31m'; GRAY='\033[0;90m'
BOLD='\033[1m'; RESET='\033[0m'

# ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────
trunc() { local s="$1" max="$2"; [ ${#s} -gt "$max" ] && echo "${s:0:$((max-3))}..." || echo "$s"; }

hr() { echo -e "  ${GRAY}$(printf '%0.s-' {1..50})${RESET}"; }

get_desc() {
  local f="$1"
  grep -m1 '^description:' "$f" 2>/dev/null \
    | sed 's/^description:[[:space:]]*//' \
    | tr -d '"'"'" \
    | sed 's/^[|[:space:]]*//' \
    | xargs
}

# ── Favoriler ─────────────────────────────────────────────────────────────────
read_favs() {
  local FAV_FILE="$CLAUDE_DIR/panel-favs.json"
  FAV_SKILLS=(); FAV_AGENTS=()
  [ -f "$FAV_FILE" ] && command -v node &>/dev/null || return
  while IFS= read -r line; do
    [[ "$line" == skill:* ]] && FAV_SKILLS+=("${line#skill:}")
    [[ "$line" == agent:* ]] && FAV_AGENTS+=("${line#agent:}")
  done < <(node -e "
    try {
      const f=require('$FAV_FILE');
      (f.skills||[]).forEach(s=>console.log('skill:'+s));
      (f.agents||[]).forEach(a=>console.log('agent:'+a));
    } catch {}
  " 2>/dev/null)
}

# ── Dil ───────────────────────────────────────────────────────────────────────
read_lang() {
  local CFG="$CLAUDE_DIR/panel-config.json"
  LANG_CODE="EN"
  [ -f "$CFG" ] && command -v node &>/dev/null || return
  LANG_CODE=$(node -e "try{console.log(require('$CFG').lang||'EN')}catch{console.log('EN')}" 2>/dev/null)
}

# ── Ana döngü ─────────────────────────────────────────────────────────────────
while true; do
  clear
  CWD=$(pwd)
  TIME=$(date '+%H:%M:%S  %d.%m.%Y')
  read_lang
  read_favs

  # --- CLAUDE.md ---
  MD_PATH=""
  for try in "$CWD/CLAUDE.md" "$HOME/CLAUDE.md"; do
    [ -f "$try" ] && MD_PATH="$try" && break
  done
  if [ -n "$MD_PATH" ]; then
    MD_BYTES=$(wc -c < "$MD_PATH" 2>/dev/null | xargs)
    MD_KB=$(awk "BEGIN {printf \"%.1f\", $MD_BYTES/1024}")
    MD_PCT=$(awk "BEGIN {p=int($MD_BYTES/40000*100); print (p>999)?999:p}")
    FILLED=$(awk "BEGIN {f=int($MD_PCT/100*20); print (f>20)?20:f}")
    BAR=$(printf '%0.s=' $(seq 1 "$FILLED" 2>/dev/null))$(printf '%0.s.' $(seq 1 "$((20-FILLED))" 2>/dev/null))
    if   [ "$MD_PCT" -ge 100 ]; then MD_COLOR=$RED
    elif [ "$MD_PCT" -ge 75  ]; then MD_COLOR=$YELLOW
    else                              MD_COLOR=$GREEN; fi
  else
    MD_KB="0"; MD_PCT=0; BAR="...................."; MD_COLOR=$GRAY
  fi

  # --- Git ---
  BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null || echo "?")
  GIT_N=$(git -C "$CWD" status --porcelain 2>/dev/null | wc -l | xargs)
  LAST_C=$(git -C "$CWD" log -1 --format="%s" 2>/dev/null || echo "")
  LAST_C=$(trunc "$LAST_C" 36)

  # --- Memory ---
  MEM_N=$(find "$CLAUDE_DIR/projects" -name "*.md" 2>/dev/null | wc -l | xargs)

  # --- Skills ---
  SKILLS=()
  if [ -d "$CLAUDE_DIR/skills" ]; then
    while IFS= read -r -d '' d; do
      SKILLS+=("$(basename "$d")")
    done < <(find "$CLAUDE_DIR/skills" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)
  fi

  # --- Agents ---
  AGENTS=(); AGENT_DESCS=()
  if [ -d "$CLAUDE_DIR/agents" ]; then
    while IFS= read -r -d '' f; do
      AGENTS+=("$(basename "$f" .md)")
      AGENT_DESCS+=("$(get_desc "$f")")
    done < <(find "$CLAUDE_DIR/agents" -maxdepth 1 -name "*.md" -print0 2>/dev/null)
  fi

  # ── Ekran ───────────────────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}${CYAN}== CLAUDE CODE PANEL ==${RESET}"
  echo -e "  ${GRAY}$TIME  [${LANG_CODE}]${RESET}"
  echo -e "  ${GRAY}$(trunc "$CWD" 48)${RESET}"
  hr

  echo ""
  echo -e "  ${YELLOW}CONTEXT / LIMIT${RESET}"
  echo -e "  ${MD_COLOR}[$BAR]  ${MD_KB} KB / 40 KB  (${MD_PCT}%)${RESET}"
  [ "$MD_PCT" -ge 100 ] && echo -e "  ${RED}!! LIMIT EXCEEDED${RESET}"
  [ -z "$MD_PATH"     ] && echo -e "  ${GRAY}(no CLAUDE.md here)${RESET}"

  echo ""
  hr
  echo -e "  ${YELLOW}GIT & MEMORY${RESET}"
  echo -e "  ${BLUE}Branch  : $BRANCH${RESET}"
  if [ "$GIT_N" -gt 0 ]; then
    echo -e "  ${YELLOW}Changed : $GIT_N files${RESET}"
  else
    echo -e "  ${GREEN}Git     : clean${RESET}"
  fi
  [ -n "$LAST_C"   ] && echo -e "  ${GRAY}Last    : $LAST_C${RESET}"
  echo -e "  ${GRAY}Memory  : $MEM_N files${RESET}"

  echo ""
  hr
  echo -e "  ${BLUE}SKILLS (${#SKILLS[@]})  -- call with /${RESET}"
  for fav in "${FAV_SKILLS[@]}"; do echo -e "  ${CYAN}* /${fav}${RESET}"; done
  for sk in "${SKILLS[@]}"; do
    is_fav=0
    for fav in "${FAV_SKILLS[@]}"; do [ "$fav" = "$sk" ] && is_fav=1; done
    [ "$is_fav" -eq 0 ] && echo -e "  ${CYAN}/${sk}${RESET}"
  done
  [ ${#SKILLS[@]} -eq 0 ] && echo -e "  ${GRAY}(none)${RESET}"

  echo ""
  hr
  echo -e "  ${GREEN}AGENTS (${#AGENTS[@]})${RESET}"
  for fav in "${FAV_AGENTS[@]}"; do echo -e "  ${GREEN}* ${fav}${RESET}"; done
  for i in "${!AGENTS[@]}"; do
    ag="${AGENTS[$i]}"
    is_fav=0
    for fav in "${FAV_AGENTS[@]}"; do [ "$fav" = "$ag" ] && is_fav=1; done
    if [ "$is_fav" -eq 0 ]; then
      desc=$(trunc "${AGENT_DESCS[$i]}" 26)
      printf "  ${GREEN}%-22s${RESET} ${GRAY}%s${RESET}\n" "$ag" "$desc"
    fi
  done
  [ ${#AGENTS[@]} -eq 0 ] && echo -e "  ${GRAY}(none)${RESET}"

  echo ""
  hr
  echo -e "  ${GRAY}${TIME}  (${INTERVAL}s refresh)  Ctrl+C to close${RESET}"

  sleep "$INTERVAL"
done
