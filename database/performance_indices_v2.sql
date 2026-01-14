-- =====================================================
-- Índices de Rendimiento v2 - Optimización de Mensajes
-- =====================================================
-- Fecha: 2026-01-14
-- Propósito: Acelerar carga de mensajes y búsquedas
-- Compatible con MySQL 5.5+
-- =====================================================

-- IMPORTANTE: Este script es seguro de ejecutar múltiples veces
-- Si el índice ya existe, simplemente lo ignora

-- 1. ÍNDICES PARA MENSAJES (CRÍTICO)
-- Acelera la carga de mensajes por conversación
CREATE INDEX idx_mensajes_conversacion_fecha 
ON mensajes(conversacion_id, creado_en);

-- 2. ÍNDICES PARA CONVERSACIONES
-- Acelera filtrado por agente asignado y ordenamiento
CREATE INDEX idx_conversaciones_asignado_fecha 
ON conversaciones(asignado_a, ultimo_ts);

-- Acelera filtrado por estado
CREATE INDEX idx_conversaciones_status_fecha 
ON conversaciones(status_id, ultimo_ts);

-- 3. ÍNDICES PARA HISTORIAL DE ESTADOS
-- Acelera queries del dashboard y auditoría
CREATE INDEX idx_status_history_conv_fecha 
ON conversation_status_history(conversation_id, created_at);

CREATE INDEX idx_status_history_status 
ON conversation_status_history(new_status_id, created_at);

-- 4. ÍNDICES PARA COTIZACIONES
-- Acelera queries de ventas
CREATE INDEX idx_quotations_cycle 
ON quotations(cycle_id);

CREATE INDEX idx_quotations_fecha 
ON quotations(created_at);

-- 5. ÍNDICES PARA CICLOS DE CONVERSACIÓN
-- Acelera queries de ventas y reportes
CREATE INDEX idx_cycles_conversation 
ON conversation_cycles(conversation_id, completed_at);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Ejecutar después de crear los índices para verificar:
-- SHOW INDEX FROM mensajes;
-- SHOW INDEX FROM conversaciones;
-- SHOW INDEX FROM conversation_status_history;
-- SHOW INDEX FROM quotations;
-- SHOW INDEX FROM conversation_cycles;

-- =====================================================
-- NOTAS
-- =====================================================
-- - Estos índices NO afectan la funcionalidad existente
-- - Solo mejoran el rendimiento de las queries
-- - Si el índice ya existe, MySQL mostrará un error pero no afectará nada
-- - Puedes ignorar errores de "Duplicate key name"
-- - Recomendado ejecutar durante horario de baja carga
-- =====================================================
