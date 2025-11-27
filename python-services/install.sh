#!/bin/bash
# Script de instalación para el servicio de embeddings en Ubuntu

echo "🚀 Instalando servicio de embeddings..."

# Verificar si estamos en el directorio correcto
if [ ! -f "embedding_service.py" ]; then
    echo "❌ Error: ejecuta este script desde la carpeta python-services"
    exit 1
fi

# Instalar Python y pip si no están instalados
echo "📦 Verificando Python..."
if ! command -v python3 &> /dev/null; then
    echo "Instalando Python3..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
fi

# Instalar dependencias
echo "📦 Instalando dependencias de Python..."
pip3 install -r requirements.txt

# Verificar instalación
echo "✅ Verificando instalación..."
python3 -c "import sentence_transformers; print('✅ sentence-transformers OK')"
python3 -c "import flask; print('✅ flask OK')"

# Opción: Instalar como servicio systemd
read -p "¿Deseas instalar como servicio systemd (se iniciará automáticamente)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Configurando servicio systemd..."

    # Ajustar rutas en el archivo de servicio
    SCRIPT_DIR=$(pwd)
    sed -i "s|/var/www/html/mensajeria-web-ga/python-services|$SCRIPT_DIR|g" embedding-service.service

    # Copiar archivo de servicio
    sudo cp embedding-service.service /etc/systemd/system/

    # Recargar systemd
    sudo systemctl daemon-reload

    # Habilitar e iniciar servicio
    sudo systemctl enable embedding-service
    sudo systemctl start embedding-service

    echo "✅ Servicio instalado y iniciado"
    echo "📊 Ver logs: sudo journalctl -u embedding-service -f"
    echo "🔄 Reiniciar: sudo systemctl restart embedding-service"
    echo "⏹️  Detener: sudo systemctl stop embedding-service"
else
    echo "⚠️  Para iniciar manualmente ejecuta: python3 embedding_service.py"
fi

# Probar el servicio
echo ""
echo "🧪 Probando servicio..."
sleep 3

if curl -s http://localhost:5001/health > /dev/null; then
    echo "✅ ¡Servicio funcionando correctamente!"
    echo "🌐 Endpoint: http://localhost:5001"
else
    echo "⚠️  El servicio no responde. Verifica los logs."
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📊 Logs: sudo journalctl -u embedding-service -n 50"
    fi
fi

echo ""
echo "✅ Instalación completa"
