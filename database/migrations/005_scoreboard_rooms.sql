-- Selecione o banco do AEC Sinuca antes de executar.
-- Estrutura independente: não modifica partidas, jogadores ou temporadas.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS scoreboard_rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_code VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  controller_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state_json JSON NOT NULL,
  state_version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  last_command_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  last_command_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  expires_at DATETIME NOT NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_scoreboard_rooms_code (room_code),
  INDEX idx_scoreboard_rooms_expiration (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version)
VALUES ('005_scoreboard_rooms')
ON DUPLICATE KEY UPDATE version = VALUES(version);
