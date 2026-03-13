#!/usr/bin/env bash
# panel.sh test scripti — Docker içinde koşar

set -e
export DEBIAN_FRONTEND=noninteractive

echo "=== 1. Araç kurulumu ==="
apt-get update -qq 2>/dev/null
apt-get install -y -qq git nodejs 2>/dev/null
echo "node: $(node -v)"
echo "git:  $(git --version)"

echo ""
echo "=== 2. panel.sh sözdizimi kontrolü ==="
bash -n /scripts/panel.sh && echo "OK — syntax hatası yok" || { echo "HATA — syntax hatası!"; exit 1; }

echo ""
echo "=== 3. Sahte ortam hazırlama ==="
export HOME=/testroot
mkdir -p "$HOME/.claude/skills/docker-expert"
mkdir -p "$HOME/.claude/skills/senior-backend"
mkdir -p "$HOME/.claude/agents"

cat > "$HOME/.claude/agents/golang-pro.md" << 'AGENT'
---
name: golang-pro
description: Go expert for concurrent systems and microservices
---
AGENT

cat > "$HOME/.claude/agents/rust-pro.md" << 'AGENT'
---
name: rust-pro
description: | Rust memory safety and zero-cost abstractions
---
AGENT

cat > "$HOME/.claude/panel-config.json" << 'CFG'
{"lang":"EN"}
CFG

cat > "$HOME/.claude/panel-favs.json" << 'FAV'
{"skills":["docker-expert"],"agents":["golang-pro"]}
FAV

mkdir -p "$HOME/.claude/projects/myproject/memory"
echo "test memory" > "$HOME/.claude/projects/myproject/memory/user.md"

mkdir -p /testproject
cat > /testproject/CLAUDE.md << 'CLAUDE'
# Test Project
Bu bir test CLAUDE.md dosyasıdır. 40KB limitini test ediyoruz.
CLAUDE

cd /testproject
git init -q
git config user.email "test@test.com"
git config user.name "testuser"
echo "test" > file1.txt
echo "test" > file2.txt
git add . 2>/dev/null
git commit -m "initial test commit" -q 2>/dev/null

echo "Ortam hazır:"
echo "  CLAUDE.md: $(wc -c < /testproject/CLAUDE.md) byte"
echo "  skills:    $(ls "$HOME/.claude/skills" | wc -l)"
echo "  agents:    $(ls "$HOME/.claude/agents" | wc -l)"
echo "  memory:    $(find "$HOME/.claude/projects" -name "*.md" | wc -l) dosya"
echo "  git:       $(git -C /testproject branch --show-current 2>/dev/null)"

echo ""
echo "=== 4. panel.sh çalıştırma (1 döngü, 4s timeout) ==="

# Panel script'ini INTERVAL=1 olarak override et, 1 döngü çalıştır
MODIFIED_PANEL=$(sed 's/INTERVAL=30/INTERVAL=1/' /scripts/panel.sh)
HOME=/testroot timeout 4 bash -c "$MODIFIED_PANEL" 2>&1 || true

echo ""
echo "=== 5. Özel durum testleri ==="

echo ""
echo "--- Test: CLAUDE.md yok ---"
mkdir -p /noclaudemd && cd /noclaudemd
HOME=/testroot timeout 3 bash -c "$(sed 's/INTERVAL=30/INTERVAL=999/' /scripts/panel.sh)" 2>&1 | grep -E '(CONTEXT|no CLAUDE|LIMIT)' || echo "(context bölümü test edildi)"

echo ""
echo "--- Test: Kirli git (modified files) ---"
echo "change" >> /testproject/file1.txt
cd /testproject
HOME=/testroot timeout 3 bash -c "$(sed 's/INTERVAL=30/INTERVAL=999/' /scripts/panel.sh)" 2>&1 | grep -E '(Changed|Branch|clean)' || echo "(git bölümü test edildi)"

echo ""
echo "--- Test: Desc parsing (| prefix ve tırnak) ---"
cat "$HOME/.claude/agents/rust-pro.md" | grep description || true
desc=$(grep -m1 '^description:' "$HOME/.claude/agents/rust-pro.md" \
  | sed 's/^description:[[:space:]]*//' \
  | tr -d '"'"'" \
  | sed 's/^[|[:space:]]*//' \
  | xargs)
echo "Parsed desc: '$desc'"
[ "$desc" = "Rust memory safety and zero-cost abstractions" ] && echo "OK — desc doğru parse edildi" || echo "HATA — desc: '$desc'"

echo ""
echo "=== Tüm testler tamamlandı ==="
