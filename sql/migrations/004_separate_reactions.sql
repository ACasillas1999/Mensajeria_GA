-- Migración: Separar reacciones de agente y cliente
-- Permite que tanto el agente como el cliente reaccionen al mismo mensaje

-- 1. Agregar columnas separadas para reacciones
ALTER TABLE mensajes
  ADD COLUMN agent_reaction_emoji VARCHAR(16) NULL COMMENT 'Reacción del agente' AFTER reaction_emoji,
  ADD COLUMN client_reaction_emoji VARCHAR(16) NULL COMMENT 'Reacción del cliente' AFTER agent_reaction_emoji;

-- 2. Migrar datos existentes basándose en reaction_by
-- Si reaction_by es NULL = cliente, si tiene valor = agente
UPDATE mensajes
SET
  agent_reaction_emoji = CASE WHEN reaction_by IS NOT NULL THEN reaction_emoji ELSE NULL END,
  client_reaction_emoji = CASE WHEN reaction_by IS NULL THEN reaction_emoji ELSE NULL END
WHERE reaction_emoji IS NOT NULL;

-- 3. Las columnas viejas (reaction_emoji y reaction_by) las dejamos por ahora
-- Se pueden eliminar después de verificar que todo funciona:
-- ALTER TABLE mensajes DROP COLUMN reaction_emoji;
-- ALTER TABLE mensajes DROP COLUMN reaction_by;
-- ALTER TABLE mensajes DROP FOREIGN KEY fk_mensajes_reaction_by;
