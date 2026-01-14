-- Tabla para almacenar cotizaciones enviadas a clientes
-- Versión sin foreign keys para evitar problemas de compatibilidad de tipos

CREATE TABLE IF NOT EXISTS quotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  cycle_id INT NULL,
  quotation_number VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  file_path VARCHAR(500) NULL,
  mensaje_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indices para mejorar rendimiento
  INDEX idx_quotation_conversation (conversation_id),
  INDEX idx_quotation_cycle (cycle_id),
  INDEX idx_quotation_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
