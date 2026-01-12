# Dashboard - Fuentes de Datos y Métricas

## Resumen

El dashboard obtiene datos de **2 APIs principales**:
1. `/api/dashboard` - Estadísticas básicas y series temporales
2. `/api/dashboard-analytics` - Métricas avanzadas de rendimiento

---

## 📊 API 1: `/api/dashboard` (Estadísticas Básicas)

### Tablas Utilizadas
- `conversaciones`
- `mensajes`
- `usuarios`
- `conversation_statuses`

### Métricas Calculadas

#### 1. **Conversaciones**
```sql
SELECT
  COUNT(*) AS total_conversaciones,
  SUM(asignado_a IS NULL) AS sin_asignar,
  SUM(asignado_a = ?) AS mine_total,  -- Mis conversaciones
  SUM(DATE(creado_en) = CURDATE()) AS conversaciones_hoy
FROM conversaciones
```

**Qué cuenta:**
- Total de conversaciones en el sistema
- Conversaciones sin asignar a ningún agente
- Conversaciones asignadas al usuario actual
- Conversaciones creadas hoy

---

#### 2. **Estados de Conversaciones**
```sql
SELECT
  cs.id, cs.name, cs.color, cs.icon,
  COUNT(c.id) AS total,
  SUM(c.asignado_a = ?) AS mine  -- Mis conversaciones en este estado
FROM conversation_statuses cs
LEFT JOIN conversaciones c ON c.status_id = cs.id
WHERE cs.is_active = TRUE
GROUP BY cs.id
```

**Qué cuenta:**
- Cuántas conversaciones hay en cada estado (Nueva, Abierta, Resuelta, etc.)
- Cuántas de esas conversaciones son del usuario actual
- Solo cuenta estados activos (`is_active = TRUE`)

---

#### 3. **Mensajes**
```sql
SELECT 
  COUNT(*) AS mensajes_total,
  SUM(DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) = CURDATE()) AS mensajes_hoy
FROM mensajes
```

**Qué cuenta:**
- Total de mensajes en el sistema
- Mensajes enviados/recibidos hoy
- Usa `creado_en` o `ts` (timestamp de WhatsApp) si no existe `creado_en`

---

#### 4. **Agentes Activos**
```sql
SELECT COUNT(*) AS agentes_activos 
FROM usuarios 
WHERE activo = 1 AND UPPER(rol) = 'AGENTE'
```

**Qué cuenta:**
- Usuarios con rol 'AGENTE' que están activos

---

#### 5. **Series Temporales (Últimos 30 días)**

**Conversaciones por día:**
```sql
SELECT DATE(creado_en) AS d, COUNT(*) AS c
FROM conversaciones
WHERE creado_en >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
GROUP BY d
```

**Mensajes por día:**
```sql
SELECT DATE(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS d, COUNT(*) AS c
FROM mensajes
WHERE COALESCE(creado_en, FROM_UNIXTIME(ts)) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
GROUP BY d
```

**Qué muestra:**
- Gráfica de tendencia de conversaciones nuevas por día
- Gráfica de tendencia de mensajes por día

---

## 📈 API 2: `/api/dashboard-analytics` (Métricas Avanzadas)

### Parámetros de Fecha
- `?days=30` - Últimos N días (por defecto 30)
- `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - Rango personalizado

### Métricas Calculadas

#### 1. **Tiempo de Primera Respuesta por Agente**
```sql
SELECT
  u.nombre AS agent_name,
  COUNT(DISTINCT c.id) AS total_conversations,
  AVG(TIMESTAMPDIFF(SECOND, c.creado_en, first_response.ts)) AS avg_response_time_seconds,
  MIN(...) AS min_response_time_seconds,
  MAX(...) AS max_response_time_seconds
FROM usuarios u
INNER JOIN conversaciones c ON c.asignado_a = u.id
INNER JOIN (
  SELECT conversacion_id, MIN(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS ts
  FROM mensajes
  WHERE from_me = 1  -- Solo mensajes del agente
  GROUP BY conversacion_id
) AS first_response ON first_response.conversacion_id = c.id
WHERE u.rol = 'AGENTE' AND c.creado_en >= [fecha]
GROUP BY u.id
```

**Qué mide:**
- Cuánto tarda cada agente en responder por primera vez
- Calcula el tiempo desde que se creó la conversación hasta el primer mensaje del agente
- Promedio, mínimo y máximo por agente

---

#### 2. **Rendimiento por Agente**
```sql
SELECT
  u.nombre AS agent_name,
  COUNT(DISTINCT c.id) AS conversations_handled,  -- Conversaciones atendidas
  COUNT(DISTINCT CASE WHEN cs.is_final = TRUE THEN c.id END) AS conversations_resolved,  -- Resueltas
  COUNT(m.id) AS messages_sent,  -- Mensajes enviados
  COUNT(DISTINCT cc.id) AS cycles_completed  -- Ciclos completados
FROM usuarios u
LEFT JOIN conversaciones c ON c.asignado_a = u.id
LEFT JOIN mensajes m ON m.usuario_id = u.id AND m.from_me = 1
LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
LEFT JOIN conversation_cycles cc ON cc.assigned_to = u.id
WHERE u.rol = 'AGENTE'
GROUP BY u.id
```

**Qué mide:**
- **conversations_handled**: Conversaciones asignadas al agente
- **conversations_resolved**: Conversaciones en estado final (cerradas/resueltas)
- **messages_sent**: Total de mensajes enviados por el agente
- **cycles_completed**: Ciclos completados por el agente
- **resolution_rate**: % de conversaciones resueltas = (resueltas / atendidas) * 100

---

#### 3. **Carga de Trabajo Actual**
```sql
SELECT
  u.nombre AS agent_name,
  COUNT(c.id) AS active_conversations,  -- Total de conversaciones
  COUNT(CASE WHEN cs.is_final = FALSE THEN c.id END) AS open_conversations  -- Abiertas
FROM usuarios u
LEFT JOIN conversaciones c ON c.asignado_a = u.id
LEFT JOIN conversation_statuses cs ON c.status_id = cs.id
WHERE u.rol = 'AGENTE'
GROUP BY u.id
```

**Qué mide:**
- Cuántas conversaciones tiene asignadas cada agente AHORA (no filtrado por fecha)
- Cuántas de esas están abiertas (no finalizadas)

---

#### 4. **Actividad por Hora del Día**
```sql
SELECT
  HOUR(COALESCE(creado_en, FROM_UNIXTIME(ts))) AS hour,
  COUNT(*) AS message_count
FROM mensajes
WHERE COALESCE(creado_en, FROM_UNIXTIME(ts)) >= [fecha]
GROUP BY hour
```

**Qué mide:**
- Cuántos mensajes se reciben/envían en cada hora del día (0-23)
- Útil para identificar horarios pico

---

#### 5. **Estadísticas de Ciclos**
```sql
SELECT
  COUNT(*) AS total_cycles,
  AVG(duration_seconds) AS avg_duration_seconds,
  AVG(total_messages) AS avg_messages_per_cycle,
  MIN(duration_seconds) AS min_duration_seconds,
  MAX(duration_seconds) AS max_duration_seconds
FROM conversation_cycles
WHERE completed_at >= [fecha]
```

**Qué mide:**
- Total de ciclos completados
- Duración promedio de un ciclo (en segundos)
- Promedio de mensajes por ciclo
- Duración mínima y máxima

---

#### 6. **Top 5 Conversaciones Más Largas**
```sql
SELECT
  c.id, c.wa_profile_name, c.wa_user,
  COUNT(m.id) AS message_count,
  u.nombre AS assigned_agent
FROM conversaciones c
LEFT JOIN mensajes m ON m.conversacion_id = c.id
LEFT JOIN usuarios u ON u.id = c.asignado_a
WHERE c.creado_en >= [fecha]
GROUP BY c.id
ORDER BY message_count DESC
LIMIT 5
```

**Qué mide:**
- Las 5 conversaciones con más mensajes
- Muestra cliente, agente asignado y cantidad de mensajes

---

#### 7. **Actividad Diaria**
```sql
SELECT
  DATE(c.creado_en) AS day,
  COUNT(DISTINCT c.id) AS conversations,
  COUNT(m.id) AS messages
FROM conversaciones c
LEFT JOIN mensajes m ON m.conversacion_id = c.id
WHERE c.creado_en >= [fecha]
GROUP BY day
```

**Qué mide:**
- Conversaciones y mensajes por día
- Para gráfica de tendencia

---

#### 8. **Satisfacción del Cliente (Reacciones)**
```sql
SELECT
  COUNT(DISTINCT conversacion_id) AS conversations_with_reactions,
  SUM(CASE WHEN client_reaction_emoji IN ('👍', '❤️', '😊', '🙏', '✅') THEN 1 ELSE 0 END) AS positive_reactions,
  SUM(CASE WHEN client_reaction_emoji IN ('👎', '😡', '😞', '💢') THEN 1 ELSE 0 END) AS negative_reactions,
  COUNT(client_reaction_emoji) AS total_reactions
FROM mensajes
WHERE client_reaction_emoji IS NOT NULL
```

**Qué mide:**
- Conversaciones donde el cliente reaccionó a mensajes
- Reacciones positivas vs negativas
- Tasa de satisfacción = (positivas / total) * 100

---

## 🔍 Resumen de Tablas y Campos Clave

### Tabla: `conversaciones`
- `id` - ID único de conversación
- `wa_user` - Número de WhatsApp del cliente
- `wa_profile_name` - Nombre del cliente
- `asignado_a` - ID del agente asignado (FK a `usuarios.id`)
- `status_id` - ID del estado (FK a `conversation_statuses.id`)
- `creado_en` - Fecha de creación
- `is_favorite` - Si está marcada como favorita
- `is_archived` - Si está archivada

### Tabla: `mensajes`
- `id` - ID único del mensaje
- `conversacion_id` - FK a `conversaciones.id`
- `usuario_id` - ID del agente que envió (si `from_me = 1`)
- `from_me` - 1 = mensaje del agente, 0 = mensaje del cliente
- `creado_en` - Fecha de creación
- `ts` - Timestamp de WhatsApp (fallback si no hay `creado_en`)
- `client_reaction_emoji` - Emoji de reacción del cliente

### Tabla: `conversation_cycles`
- `id` - ID único del ciclo
- `conversation_id` - FK a `conversaciones.id`
- `assigned_to` - ID del agente asignado
- `completed_at` - Fecha de completado
- `duration_seconds` - Duración del ciclo en segundos
- `total_messages` - Total de mensajes en el ciclo
- `sale_registered` - Si se registró una venta
- `sale_amount` - Monto de la venta

### Tabla: `conversation_statuses`
- `id` - ID único del estado
- `name` - Nombre del estado (ej: "Nueva", "Abierta", "Resuelta")
- `color` - Color hexadecimal
- `icon` - Emoji del estado
- `is_final` - TRUE si es un estado final (conversación cerrada)
- `is_active` - TRUE si el estado está activo
- `display_order` - Orden de visualización

### Tabla: `usuarios`
- `id` - ID único del usuario
- `nombre` - Nombre del agente
- `rol` - Rol: 'ADMIN' o 'AGENTE'
- `activo` - 1 = activo, 0 = inactivo

---

## 📌 Notas Importantes

1. **Filtros de Fecha**: Todas las métricas avanzadas respetan el rango de fechas seleccionado en el dashboard
2. **Permisos**: Los agentes ven sus propias métricas, los admins ven todo
3. **Tiempo Real**: La carga de trabajo actual NO se filtra por fecha (muestra estado actual)
4. **Fallback de Timestamps**: Se usa `COALESCE(creado_en, FROM_UNIXTIME(ts))` porque algunos mensajes antiguos solo tienen `ts`
5. **Estados Finales**: Un estado con `is_final = TRUE` indica que la conversación está cerrada/resuelta

---

## 🎯 Casos de Uso

### ¿Cuántas conversaciones nuevas tuvimos esta semana?
- **API**: `/api/dashboard`
- **Métrica**: `conv_series` (últimos 30 días)
- **Filtrar**: Sumar los últimos 7 días

### ¿Qué agente responde más rápido?
- **API**: `/api/dashboard-analytics`
- **Métrica**: `response_times`
- **Ordenar**: Por `avg_response_time_seconds` ascendente

### ¿Cuál es la carga de trabajo actual de cada agente?
- **API**: `/api/dashboard-analytics`
- **Métrica**: `workload`
- **Ver**: `open_conversations` por agente

### ¿A qué hora recibimos más mensajes?
- **API**: `/api/dashboard-analytics`
- **Métrica**: `hourly_activity`
- **Ver**: Gráfica de barras por hora

### ¿Cuántos ciclos se completaron este mes?
- **API**: `/api/dashboard-analytics`
- **Métrica**: `cycle_stats.total_cycles`
- **Filtrar**: `?days=30`

### ¿Qué tan satisfechos están los clientes?
- **API**: `/api/dashboard-analytics`
- **Métrica**: `satisfaction.satisfaction_rate`
- **Fórmula**: (reacciones positivas / total reacciones) * 100
