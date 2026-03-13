#!/usr/bin/env python3
"""Docker içinde panel.sh test koşturucusu"""
import subprocess, sys, os

SCRIPTS = os.path.join(os.path.dirname(__file__))

INNER = r"""
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>/dev/null
apt-get install -y -qq git nodejs 2>/dev/null

# CRLF -> LF
for f in panel.sh; do
  tr -d '\r' < /mnt/$f > /tmp/$f
  chmod +x /tmp/$f
done

echo "=== 1. Araçlar ==="
node --version
git --version

echo ""
echo "=== 2. Sözdizimi ==="
bash -n /tmp/panel.sh && echo "OK — syntax hatası yok" || { echo "HATA — syntax!"; exit 1; }

echo ""
echo "=== 3. Ortam ==="
export HOME=/r
mkdir -p $HOME/.claude/skills/docker-expert $HOME/.claude/skills/senior-backend $HOME/.claude/agents
printf -- '---\nname: golang-pro\ndescription: Go expert for concurrent systems\n---\n' > $HOME/.claude/agents/golang-pro.md
printf -- '---\nname: rust-pro\ndescription: Rust memory safety and zero-cost abstractions\n---\n' > $HOME/.claude/agents/rust-pro.md
printf '{"lang":"EN"}' > $HOME/.claude/panel-config.json
printf '{"skills":["docker-expert"],"agents":["golang-pro"]}' > $HOME/.claude/panel-favs.json
mkdir -p $HOME/.claude/projects/p/memory && echo "mem" > $HOME/.claude/projects/p/memory/u.md

mkdir -p /proj && printf '# Claude.md Test\nThis is a test file.\n' > /proj/CLAUDE.md
cd /proj && git init -q
git config user.email "t@t.com" && git config user.name "t"
echo "file" > f.txt && git add . && git commit -m "init" -q
echo "changed" >> f.txt  # dirty working tree

echo "CLAUDE.md: $(wc -c < /proj/CLAUDE.md) byte"
echo "skills: $(ls $HOME/.claude/skills | wc -l) | agents: $(ls $HOME/.claude/agents/*.md | wc -l)"
echo "memory: $(find $HOME/.claude/projects -name '*.md' | wc -l) dosya"
echo "branch: $(git -C /proj branch --show-current)"

echo ""
echo "=== 4. Panel canlı çalışma (1 döngü) ==="
PSRC=$(cat /tmp/panel.sh)
PMOD="${PSRC/INTERVAL=30/INTERVAL=1}"
cd /proj && HOME=/r timeout 4 bash -c "$PMOD" || true

echo ""
echo "=== 5. Desc parsing ==="
desc=$(grep -m1 '^description:' $HOME/.claude/agents/rust-pro.md | sed 's/^description:[[:space:]]*//' | tr -d '"'"'" | sed 's/^[|[:space:]]*//' | xargs)
echo "Parsed desc: '$desc'"
[ "$desc" = "Rust memory safety and zero-cost abstractions" ] && echo "OK — parse dogru" || echo "FARK: '$desc'"

echo ""
echo "=== 6. CLAUDE.md yok senaryosu ==="
mkdir -p /empty && cd /empty && git init -q
git config user.email "t@t.com" && git config user.name "t"
git commit --allow-empty -m "e" -q
PMOD2="${PSRC/INTERVAL=30/INTERVAL=999}"
HOME=/r timeout 3 bash -c "$PMOD2" 2>&1 | grep -E '(CONTEXT|no CLAUDE|0\.0|LIMIT)' | head -3

echo ""
echo "=== Tüm testler TAMAMLANDI ==="
"""

result = subprocess.run(
    ["docker", "run", "--rm",
     "-v", f"{SCRIPTS}:/mnt",
     "ubuntu:22.04",
     "bash", "-c", INNER],
    capture_output=False,
    text=True
)
sys.exit(result.returncode)
