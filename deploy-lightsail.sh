#!/bin/bash

# Script de deploy para Lightsail
# Uso: ./deploy-lightsail.sh

echo "🚀 Iniciando deploy a Lightsail..."

# Variables
SERVER_IP="107.21.163.64"
SERVER_USER="ubuntu"
PROJECT_DIR="~/mensajeria-app"

# Colores
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo "📦 Haciendo build local..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Error en el build"
    exit 1
fi

echo "📤 Subiendo archivos al servidor..."

# Subir solo archivos necesarios (excluir node_modules, .git, etc.)
rsync -avz --exclude 'node_modules' \
           --exclude '.git' \
           --exclude 'dist' \
           --exclude '.env*' \
           --exclude 'lambda-*' \
           --exclude 's3-assets' \
           ./ ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/

echo "📤 Subiendo dist..."
rsync -avz dist/ ${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/dist/

echo "🔧 Instalando dependencias y reiniciando en servidor..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd ~/mensajeria-app

# Instalar solo dependencias de producción
npm install --omit=dev

# Reiniciar con PM2
pm2 restart ecosystem.config.js --update-env

# Ver status
pm2 status
ENDSSH

echo "${GREEN}✅ Deploy completado!${NC}"
echo "🌐 URL: http://107.21.163.64:4321"
echo "📊 Ver logs: ssh ubuntu@107.21.163.64 'pm2 logs'"
