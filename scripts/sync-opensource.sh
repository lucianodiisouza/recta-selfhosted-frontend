#!/usr/bin/env bash
# Sincroniza este repo privado -> repo open-source (snapshot, 1 commit por sync).
# Roda na CI (via GH_TOKEN) ou localmente (via SSH). Config por variáveis de ambiente:
#   TARGET_REPO  (obrigatório)  owner/nome do repo público, ex: lucianodiisouza/recta-selfhosted-backend
#   EXCLUDE      (opcional)     paths que NUNCA vão pro público (segredos/obsoletos), separados por espaço
#   PRESERVE     (opcional)     paths que só existem no público e devem ser mantidos
#   GH_TOKEN     (CI)           token com escrita no TARGET_REPO; se ausente, usa SSH
#   DRY_RUN=1    (opcional)     mostra o diff e não faz push
set -euo pipefail

: "${TARGET_REPO:?defina TARGET_REPO=owner/nome-do-repo-publico}"
EXCLUDE="${EXCLUDE:-}"
PRESERVE="${PRESERVE:-.git LICENSE LICENSE.md SECURITY.md CODE_OF_CONDUCT.md CONTRIBUTING.md .github README.md}"
DRY_RUN="${DRY_RUN:-0}"

PRIV="$(git rev-parse --show-toplevel)"
SHA="$(git -C "$PRIV" rev-parse --short HEAD)"
WORK="$(mktemp -d)"; STAGE="$(mktemp -d)"
trap 'rm -rf "$WORK" "$STAGE"' EXIT

echo ">> Exportando arquivos rastreados do privado @ $SHA"
git -C "$PRIV" archive HEAD | tar -x -C "$STAGE"

echo ">> Removendo exclusões do stage:"
for p in $EXCLUDE; do rm -rf "${STAGE:?}/$p" && echo "   - $p"; done

if [ -n "${GH_TOKEN:-}" ]; then
  REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${TARGET_REPO}.git"
else
  REMOTE="git@github.com:${TARGET_REPO}.git"
fi

echo ">> Clonando o público ($TARGET_REPO)"
git clone --quiet "$REMOTE" "$WORK"

echo ">> Sincronizando (preservando arquivos public-only)"
EX=(); for p in $PRESERVE; do EX+=( --exclude="/$p" ); done
rsync -a --delete "${EX[@]}" "$STAGE"/ "$WORK"/

cd "$WORK"
git add -A
if git diff --cached --quiet; then
  echo ">> Nada mudou. Público já está sincronizado."
  exit 0
fi

echo "===================== MUDANÇAS ====================="
git diff --cached --stat
echo "===================================================="

# trava: aborta se algum arquivo excluído acabou entrando no commit
for p in $EXCLUDE; do
  if git ls-files --cached --error-unmatch "$p" >/dev/null 2>&1; then
    echo "❌ ABORTADO: '$p' entrou no commit do público!"; exit 1
  fi
done

if [ "$DRY_RUN" = "1" ]; then
  echo ">> DRY-RUN: nada commitado nem enviado."
  exit 0
fi

git -c user.name="recta-sync[bot]" -c user.email="actions@users.noreply.github.com" \
    commit --quiet -m "chore: sync from private @ $SHA"
git push origin HEAD:main
echo "✅ Sync publicado em $TARGET_REPO @ $SHA"
