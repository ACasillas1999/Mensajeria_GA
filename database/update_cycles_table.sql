-- Asegurar que la tabla conversation_cycles tenga la columna para datos JSON
-- Ejecuta esto en tu base de datos (pestaña SQL en phpMyAdmin o consola)

-- 1. Intentar agregar la columna cycle_data (si usas MySQL 5.7+ o MariaDB moderno)
-- Si da error "Duplicate column name", es que ya existe y puedes ignorarlo.
ALTER TABLE conversation_cycles ADD COLUMN cycle_data JSON DEFAULT NULL;

-- 2. Asegurar que tenemos indices para búsquedas rápidas en reportes
CREATE INDEX idx_cycles_completed_at ON conversation_cycles(completed_at);
CREATE INDEX idx_cycles_final_status ON conversation_cycles(final_status_id);
CREATE INDEX idx_cycles_assigned_to ON conversation_cycles(assigned_to);
