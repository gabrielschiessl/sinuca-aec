-- Requer 005. Selecione o banco do AEC Sinuca antes de executar.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- Permite reaplicar sem recriar a coluna. Não substitui conferência do schema.
SET @scoreboard_password_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'scoreboard_rooms'
    AND column_name = 'control_password_hash'
);
SET @scoreboard_password_sql = IF(@scoreboard_password_exists = 0,
  'ALTER TABLE scoreboard_rooms ADD COLUMN control_password_hash VARCHAR(255) NULL AFTER controller_token_hash',
  'SELECT 1'
);
PREPARE scoreboard_password_statement FROM @scoreboard_password_sql;
EXECUTE scoreboard_password_statement;
DEALLOCATE PREPARE scoreboard_password_statement;

CREATE TABLE IF NOT EXISTS scoreboard_rate_limits (
  bucket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  window_started_at BIGINT UNSIGNED NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  INDEX idx_scoreboard_limits_expiration (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version)
VALUES ('006_scoreboard_control')
ON DUPLICATE KEY UPDATE version = VALUES(version);
