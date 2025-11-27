# Servicio de Embeddings Local

Servicio Python que proporciona embeddings locales gratuitos para auto-respuestas inteligentes.

## Instalación

### Windows (XAMPP)

1. Instalar Python 3.9+ si no lo tienes:
   - Descargar de https://www.python.org/downloads/
   - ✅ Marcar "Add Python to PATH" durante instalación

2. Abrir CMD o PowerShell en esta carpeta y ejecutar:
```bash
pip install -r requirements.txt
```

### Linux/Mac

```bash
pip3 install -r requirements.txt
```

## Uso

### Iniciar el servicio:

```bash
python embedding_service.py
```

El servicio correrá en http://localhost:5001

### Verificar que funciona:

```bash
curl http://localhost:5001/health
```

Debe responder:
```json
{"status": "ok", "model": "paraphrase-multilingual-MiniLM-L12-v2"}
```

## Configuración como servicio de Windows

Para que corra automáticamente al iniciar Windows:

1. Crear archivo `start_embedding_service.bat` con:
```batch
@echo off
cd /d "\\192.168.60.117\xampp\htdocs\mensajeria-web-ga\python-services"
python embedding_service.py
```

2. Crear acceso directo del .bat en:
```
C:\Users\TU_USUARIO\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
```

## API Endpoints

### POST /embed
Genera embeddings para textos
```json
{
  "texts": ["hola", "buenos días"]
}
```

### POST /similarity
Encuentra textos similares
```json
{
  "query": "a qué hora abren",
  "references": [
    {"id": 1, "text": "horario de atención"},
    {"id": 2, "text": "servicios disponibles"}
  ],
  "threshold": 0.7
}
```

## Recursos

- Modelo: ~118MB (se descarga automáticamente la primera vez)
- RAM: ~500MB en uso
- CPU: Mínimo requerido (funciona sin GPU)

## Troubleshooting

**Error: torch no se instala**
```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

**Error: puerto 5001 en uso**
Cambiar puerto en `embedding_service.py` línea final:
```python
app.run(host='0.0.0.0', port=5002, debug=False)
```
