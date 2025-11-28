-- Datos de prueba para el sistema de auto-aprendizaje
-- Esto simula que varios clientes preguntaron por delivery

-- IMPORTANTE: Esto insertará mensajes de prueba en unrecognized_messages
-- Solo ejecuta si quieres datos de prueba para ver el sistema funcionando

-- Opción 1: Preguntas sobre delivery (6 mensajes similares)
INSERT INTO unrecognized_messages (conversacion_id, message_text, created_at) VALUES
(1, 'tienen delivery?', NOW() - INTERVAL 1 HOUR),
(2, 'hacen delivery?', NOW() - INTERVAL 2 HOUR),
(3, 'tienen envio a domicilio?', NOW() - INTERVAL 3 HOUR),
(4, 'hay delivery?', NOW() - INTERVAL 4 HOUR),
(5, 'delivery disponible?', NOW() - INTERVAL 5 HOUR),
(6, 'tienen delivery', NOW() - INTERVAL 6 HOUR);

-- Opción 2: Preguntas sobre horarios (7 mensajes similares)
INSERT INTO unrecognized_messages (conversacion_id, message_text, created_at) VALUES
(7, 'cual es el horario?', NOW() - INTERVAL 1 DAY),
(8, 'horario de atencion?', NOW() - INTERVAL 1 DAY - INTERVAL 1 HOUR),
(9, 'a que hora abren?', NOW() - INTERVAL 1 DAY - INTERVAL 2 HOUR),
(10, 'horarios?', NOW() - INTERVAL 1 DAY - INTERVAL 3 HOUR),
(11, 'cuando abren?', NOW() - INTERVAL 1 DAY - INTERVAL 4 HOUR),
(12, 'cual es su horario', NOW() - INTERVAL 1 DAY - INTERVAL 5 HOUR),
(13, 'horario de servicio?', NOW() - INTERVAL 1 DAY - INTERVAL 6 HOUR);

-- Opción 3: Preguntas sobre precios (5 mensajes similares - justo el mínimo)
INSERT INTO unrecognized_messages (conversacion_id, message_text, created_at) VALUES
(14, 'cuanto cuesta?', NOW() - INTERVAL 2 DAY),
(15, 'cual es el precio?', NOW() - INTERVAL 2 DAY - INTERVAL 1 HOUR),
(16, 'precio?', NOW() - INTERVAL 2 DAY - INTERVAL 2 HOUR),
(17, 'cuanto sale?', NOW() - INTERVAL 2 DAY - INTERVAL 3 HOUR),
(18, 'cuanto es el costo?', NOW() - INTERVAL 2 DAY - INTERVAL 4 HOUR);

-- Opción 4: Pregunta que NO debería generar sugerencia (solo 3 veces)
INSERT INTO unrecognized_messages (conversacion_id, message_text, created_at) VALUES
(19, 'tienen descuentos?', NOW() - INTERVAL 3 DAY),
(20, 'hay descuentos?', NOW() - INTERVAL 3 DAY - INTERVAL 1 HOUR),
(21, 'descuentos disponibles?', NOW() - INTERVAL 3 DAY - INTERVAL 2 HOUR);

-- Verificar que se insertaron correctamente
SELECT 'Mensajes insertados:' as info, COUNT(*) as total
FROM unrecognized_messages
WHERE created_at >= NOW() - INTERVAL 4 DAY;

SELECT 'Agrupados por frase:' as info, '' as total
UNION ALL
SELECT message_text, CAST(COUNT(*) as CHAR)
FROM unrecognized_messages
WHERE created_at >= NOW() - INTERVAL 4 DAY
GROUP BY message_text
ORDER BY COUNT(*) DESC;

-- RESULTADO ESPERADO:
-- ✅ 21 mensajes insertados
-- ✅ 6 sobre delivery
-- ✅ 7 sobre horarios
-- ✅ 5 sobre precios
-- ✅ 3 sobre descuentos (no generará sugerencia porque < 5)
