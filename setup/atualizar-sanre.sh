#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Atualiza a Óticas Sanrê na VPS: git pull da main → npm install → build →
# schema (db:push + migrations) → seed na primeira vez → restart no pm2.
#
# Instalado em /var/www/atualizar-sanre.sh (cópia deste arquivo, versionado em
# setup/). Roda como root; o app roda no pm2 do claude-user (daemon de produção).
#
#   bash /var/www/atualizar-sanre.sh
#
# Sucesso = última linha ">>> sanre atualizado com sucesso!". Com `set -e`, se
# install/build falhar o processo antigo continua no ar.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SITE_DIR="/var/www/sanre"
APP_NAME="sanre"
REPO_URL="https://github.com/olsenrodrigo/sanre.git"
PM2_USER="claude-user"
PM2_HOME_DIR="/home/$PM2_USER"

if [ "$(id -u)" -ne 0 ]; then
  echo ">>> ERRO: execute como root (use sudo)."
  exit 1
fi

echo ">>> Atualizando $APP_NAME..."

# Primeira execução: prepara o repositório. Funciona mesmo com o .env já
# criado na pasta (git clone recusaria diretório não vazio).
if [ ! -d "$SITE_DIR/.git" ]; then
  echo ">>> Primeira instalação: baixando $REPO_URL em $SITE_DIR"
  mkdir -p "$SITE_DIR"
  chown "$PM2_USER:$PM2_USER" "$SITE_DIR"
  sudo -u "$PM2_USER" bash -c "cd '$SITE_DIR' && git init -q -b main && git remote add origin '$REPO_URL' && git fetch -q origin main && git checkout -q -f -B main origin/main && git branch -q --set-upstream-to=origin/main main"
fi

if [ ! -f "$SITE_DIR/.env" ]; then
  echo ">>> ERRO: falta $SITE_DIR/.env (copie de .env.example e preencha DATABASE_URL, JWT_SECRET, PORT...)."
  exit 1
fi

cd "$SITE_DIR"
git config --global --add safe.directory "$SITE_DIR"

if [ -n "$(git status --porcelain | grep '^UU')" ]; then
  echo ">>> ERRO: conflito de merge não resolvido em $SITE_DIR. Resolva antes de rodar de novo:"
  git status --porcelain | grep '^UU'
  exit 1
fi

STASHED=false
if ! git diff --quiet 2>/dev/null; then
  sudo -u "$PM2_USER" git stash
  STASHED=true
  echo ">>> Mudanças locais salvas via stash"
fi

sudo -u "$PM2_USER" git pull --no-rebase origin main

if [ "$STASHED" = true ]; then
  if ! sudo -u "$PM2_USER" git stash pop; then
    echo ">>> ERRO: conflito ao reaplicar mudanças locais (git stash pop). Resolva em $SITE_DIR e rode de novo."
    exit 1
  fi
fi

echo ">>> Commit: $(git log --oneline -1)"

sudo -u "$PM2_USER" npm install --silent --no-audit --no-fund
sudo -u "$PM2_USER" npm run build

# Schema: db:push reconcilia com shared/schema.ts e APAGA FK/índice/CHECK que
# não estão declarados lá; as migrations/*.sql (idempotentes) vêm DEPOIS e
# recriam tudo. Nunca inverter a ordem.
echo ">>> Schema: drizzle-kit push"
sudo -u "$PM2_USER" bash -c "set -a; source '$SITE_DIR/.env'; set +a; npx drizzle-kit push --force"

echo ">>> Schema: migrations/*.sql"
sudo -u "$PM2_USER" bash -c "set -a; source '$SITE_DIR/.env'; set +a; \
  for f in '$SITE_DIR'/migrations/*.sql; do \
    psql \"\$DATABASE_URL\" -q -v ON_ERROR_STOP=1 -f \"\$f\" >/dev/null || { echo \"falhou: \$f\"; exit 1; }; \
  done"

# Catálogo-semente só quando a vitrine está vazia (nunca apaga catálogo real)
PRODUTOS=$(sudo -u "$PM2_USER" bash -c "set -a; source '$SITE_DIR/.env'; set +a; psql \"\$DATABASE_URL\" -tAc 'select count(*) from products'")
if [ "${PRODUTOS:-0}" = "0" ] && [ -f "$SITE_DIR/script/catalogo-oculos.json" ]; then
  echo ">>> Vitrine vazia: rodando o seed do catálogo"
  sudo -u "$PM2_USER" bash -c "cd '$SITE_DIR'; set -a; source '$SITE_DIR/.env'; set +a; npm run seed"
fi

# pm2 do claude-user, com as variáveis do .env exportadas
pm2_prod() {
  sudo -u "$PM2_USER" bash -c "cd '$SITE_DIR'; export HOME='$PM2_HOME_DIR'; set -a; source '$SITE_DIR/.env'; set +a; pm2 $*"
}

if pm2_prod describe "$APP_NAME" >/dev/null 2>&1; then
  echo ">>> Reiniciando $APP_NAME no pm2 de $PM2_USER..."
  pm2_prod restart "$APP_NAME" --update-env
else
  echo ">>> Criando $APP_NAME no pm2 de $PM2_USER..."
  pm2_prod start npm --name "$APP_NAME" -- start
fi
pm2_prod save

echo ">>> $APP_NAME atualizado com sucesso!"
