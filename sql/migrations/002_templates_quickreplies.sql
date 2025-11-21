-- Migración: Plantillas de WhatsApp y Respuestas Rápidas
-- Ejecutar en MySQL/MariaDB

-- Tabla de plantillas de WhatsApp (aprobadas por Meta)
CREATE TABLE IF NOT EXISTS plantillas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  idioma VARCHAR(10) DEFAULT 'es',
  categoria ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION') DEFAULT 'UTILITY',
  estado ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING',
  -- Componentes de la plantilla (JSON)
  header_type ENUM('NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT') DEFAULT 'NONE',
  header_text VARCHAR(60),
  body_text TEXT NOT NULL,
  footer_text VARCHAR(60),
  -- Variables {{1}}, {{2}}, etc
  variables_ejemplo JSON,
  -- Botones (JSON array)
  botones JSON,
  -- Meta
  wa_template_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de respuestas rápidas (no requieren aprobación)
CREATE TABLE IF NOT EXISTS respuestas_rapidas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  contenido TEXT NOT NULL,
  categoria VARCHAR(50),
  atajo VARCHAR(20),
  uso_count INT DEFAULT 0,
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_atajo (atajo),
  INDEX idx_categoria (categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar algunas respuestas rápidas de ejemplo
INSERT INTO respuestas_rapidas (titulo, contenido, categoria, atajo) VALUES
('Saludo inicial', 'Hola, gracias por comunicarte con nosotros. ¿En qué puedo ayudarte?', 'Saludos', '/hola'),
('Despedida', 'Gracias por contactarnos. ¡Que tengas un excelente día!', 'Saludos', '/bye'),
('Horario de atención', 'Nuestro horario de atención es de Lunes a Viernes de 9:00 a 18:00 hrs.', 'Info', '/horario'),
('Solicitar datos', 'Para poder ayudarte mejor, ¿podrías proporcionarme tu nombre completo y número de pedido?', 'Soporte', '/datos'),
('En proceso', 'Tu solicitud está siendo procesada. Te notificaremos en cuanto tengamos una actualización.', 'Soporte', '/proceso'),
('Transferir', 'Voy a transferirte con un especialista que podrá ayudarte mejor con tu consulta.', 'Soporte', '/transfer');
