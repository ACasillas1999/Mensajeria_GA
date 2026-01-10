-- ============================================
-- MIGRACIONES COMPLETAS - CHAT INTERNO (SIN FOREIGN KEYS)
-- Versión compatible - Copiar y pegar TODO en phpMyAdmin
-- ============================================

-- 1. TABLA DE CANALES
CREATE TABLE IF NOT EXISTS internal_channels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  type ENUM('public', 'private') DEFAULT 'public',
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived BOOLEAN DEFAULT 0,
  write_permission ENUM('all', 'admins', 'owner') DEFAULT 'all',
  invite_permission ENUM('all', 'admins', 'owner') DEFAULT 'admins',
  thread_permission ENUM('all', 'admins') DEFAULT 'all',
  pin_permission ENUM('all', 'admins') DEFAULT 'admins',
  delete_permission ENUM('own', 'admins', 'all') DEFAULT 'own',
  INDEX idx_type (type),
  INDEX idx_archived (archived),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABLA DE MIEMBROS DE CANALES
CREATE TABLE IF NOT EXISTS internal_channel_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member', 'readonly') DEFAULT 'member',
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invited_by INT,
  UNIQUE KEY unique_channel_user (channel_id, user_id),
  INDEX idx_channel (channel_id),
  INDEX idx_user (user_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABLAS DE MENSAJES DIRECTOS
CREATE TABLE IF NOT EXISTS internal_dm_chats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_dm_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_chat_user (chat_id, user_id),
  INDEX idx_chat (chat_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLA DE MENSAJES
CREATE TABLE IF NOT EXISTS internal_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_id INT,
  dm_chat_id INT,
  user_id INT NOT NULL,
  message_type ENUM('text', 'file', 'audio', 'image') DEFAULT 'text',
  content TEXT,
  file_url VARCHAR(500),
  file_name VARCHAR(255),
  file_size INT,
  file_mime_type VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  edited_at DATETIME,
  deleted_at DATETIME,
  parent_message_id INT,
  INDEX idx_channel_created (channel_id, created_at DESC),
  INDEX idx_dm_created (dm_chat_id, created_at DESC),
  INDEX idx_user (user_id),
  INDEX idx_type (message_type),
  INDEX idx_parent (parent_message_id),
  INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABLAS DE CARPETAS
CREATE TABLE IF NOT EXISTS internal_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  position INT DEFAULT 0,
  collapsed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_position (user_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_folder_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folder_id INT NOT NULL,
  channel_id INT,
  dm_chat_id INT,
  position INT DEFAULT 0,
  UNIQUE KEY unique_folder_channel (folder_id, channel_id),
  UNIQUE KEY unique_folder_dm (folder_id, dm_chat_id),
  INDEX idx_folder_position (folder_id, position),
  INDEX idx_channel (channel_id),
  INDEX idx_dm (dm_chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABLA DE REACCIONES
CREATE TABLE IF NOT EXISTS internal_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_message_user_emoji (message_id, user_id, emoji),
  INDEX idx_message (message_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABLA DE FAVORITOS
CREATE TABLE IF NOT EXISTS internal_favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  channel_id INT,
  dm_chat_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_channel (user_id, channel_id),
  UNIQUE KEY unique_user_dm (user_id, dm_chat_id),
  INDEX idx_user (user_id),
  INDEX idx_channel (channel_id),
  INDEX idx_dm (dm_chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TABLA DE MENSAJES ANCLADOS
CREATE TABLE IF NOT EXISTS internal_pinned_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  channel_id INT NOT NULL,
  message_id INT NOT NULL,
  pinned_by INT NOT NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_channel_message (channel_id, message_id),
  INDEX idx_channel (channel_id),
  INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TABLA DE ESTADO DE LECTURA
CREATE TABLE IF NOT EXISTS internal_read_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  channel_id INT,
  dm_chat_id INT,
  last_read_message_id INT,
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_channel (user_id, channel_id),
  UNIQUE KEY unique_user_dm (user_id, dm_chat_id),
  INDEX idx_user (user_id),
  INDEX idx_channel (channel_id),
  INDEX idx_dm (dm_chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TABLA DE ESCRIBIENDO
CREATE TABLE IF NOT EXISTS internal_typing_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  channel_id INT,
  dm_chat_id INT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_channel (user_id, channel_id),
  UNIQUE KEY unique_user_dm (user_id, dm_chat_id),
  INDEX idx_channel_updated (channel_id, updated_at),
  INDEX idx_dm_updated (dm_chat_id, updated_at),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. DATOS INICIALES (SEED)
-- Canales por defecto
INSERT IGNORE INTO internal_channels (id, name, description, type, created_by, write_permission, invite_permission)
VALUES 
  (1, 'general', 'Canal general para anuncios y novedades del equipo', 'public', 1, 'all', 'admins'),
  (2, 'soporte', 'Escalamientos y casos de soporte técnico', 'public', 1, 'all', 'admins'),
  (3, 'ventas', 'Leads, seguimiento y coordinación de ventas', 'public', 1, 'all', 'admins'),
  (4, 'anuncios', 'Anuncios oficiales de la empresa', 'public', 1, 'admins', 'admins');

-- Mensaje de bienvenida
INSERT IGNORE INTO internal_messages (id, channel_id, user_id, message_type, content)
VALUES (1, 1, 1, 'text', '¡Bienvenido al sistema de mensajería interna! 🎉

Este es el canal #general donde puedes compartir novedades, anuncios y comunicarte con todo el equipo.

Canales disponibles:
• #general - Comunicación general del equipo
• #soporte - Escalamientos y casos técnicos
• #ventas - Coordinación de ventas y leads
• #anuncios - Anuncios oficiales (solo lectura)

También puedes crear carpetas personalizadas para organizar tus chats y enviar mensajes directos a otros miembros del equipo.

¡Comencemos a colaborar! 💪');

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT '✅ Tablas creadas exitosamente!' as status;
SHOW TABLES LIKE 'internal_%';

SELECT '✅ Canales por defecto creados!' as status;
SELECT id, name, description FROM internal_channels;

SELECT '✅ Mensaje de bienvenida creado!' as status;
SELECT id, channel_id, LEFT(content, 50) as mensaje_preview FROM internal_messages LIMIT 1;
