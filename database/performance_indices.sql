-- Optimizaciones de Base de Datos para Mensajería
-- Ejecutar estos comandos en MySQL para mejorar rendimiento

-- 1. Índice compuesto para consultas de mensajes por conversación
-- Mejora la query principal que ordena por timestamp
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion_ts 
ON mensajes(conversacion_id, ts DESC);

-- 2. Índice para created_at (usado en algunas queries)
CREATE INDEX IF NOT EXISTS idx_mensajes_created_at 
ON mensajes(creado_en DESC);

-- 3. Índice para búsquedas por wa_msg_id (usado en actualizaciones de estado)
CREATE INDEX IF NOT EXISTS idx_mensajes_wa_msg_id 
ON mensajes(wa_msg_id);

-- 4. Índice para conversaciones por usuario
CREATE INDEX IF NOT EXISTS idx_conversaciones_wa_user 
ON conversaciones(wa_user);

-- 5. Índice para último timestamp de conversación
CREATE INDEX IF NOT EXISTS idx_conversaciones_ultimo_ts 
ON conversaciones(ultimo_ts DESC);

-- Verificar índices creados
SHOW INDEX FROM mensajes;
SHOW INDEX FROM conversaciones;

-- Analizar queries para verificar uso de índices
-- EXPLAIN SELECT * FROM mensajes WHERE conversacion_id = 1 ORDER BY ts DESC LIMIT 50;
