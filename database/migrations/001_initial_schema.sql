SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(50) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  nickname VARCHAR(80) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_players_active_display (active, display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seasons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  year SMALLINT UNSIGNED NOT NULL,
  version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL,
  origin VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_seasons_year (year),
  INDEX idx_seasons_status_year (status, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS season_divisions (
  season_id BIGINT UNSIGNED NOT NULL,
  division CHAR(1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (season_id, division),
  CONSTRAINT fk_season_divisions_season
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  season_id BIGINT UNSIGNED NOT NULL,
  division CHAR(1) NOT NULL,
  number SMALLINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  tiebreak_priority SMALLINT UNSIGNED NULL,
  direct_wo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_participants_number (season_id, division, number),
  INDEX idx_participants_season_player (season_id, player_id),
  INDEX idx_participants_lookup (season_id, division, number, player_id),
  CONSTRAINT fk_participants_season_division
    FOREIGN KEY (season_id, division)
    REFERENCES season_divisions(season_id, division) ON DELETE CASCADE,
  CONSTRAINT fk_participants_player
    FOREIGN KEY (player_id) REFERENCES players(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rounds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  season_id BIGINT UNSIGNED NOT NULL,
  division CHAR(1) NOT NULL,
  number SMALLINT UNSIGNED NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
  scheduled_date DATE NULL,
  scheduled_time TIME NULL,
  bye_participant_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rounds_number (season_id, division, number, type),
  INDEX idx_rounds_schedule (season_id, division, scheduled_date, number),
  CONSTRAINT fk_rounds_season_division
    FOREIGN KEY (season_id, division)
    REFERENCES season_divisions(season_id, division) ON DELETE CASCADE,
  CONSTRAINT fk_rounds_bye_participant
    FOREIGN KEY (bye_participant_id) REFERENCES participants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  round_id BIGINT UNSIGNED NOT NULL,
  match_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  participant1_id BIGINT UNSIGNED NOT NULL,
  participant2_id BIGINT UNSIGNED NOT NULL,
  scheduled_date DATE NULL,
  scheduled_time TIME NULL,
  status CHAR(1) NOT NULL DEFAULT 'A',
  score1 TINYINT UNSIGNED NULL,
  score2 TINYINT UNSIGNED NULL,
  notes VARCHAR(300) NOT NULL DEFAULT '',
  row_version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_matches_round_participants (round_id, participant1_id, participant2_id),
  UNIQUE KEY uq_matches_round_order (round_id, match_order),
  INDEX idx_matches_status (round_id, status),
  INDEX idx_matches_participant1 (participant1_id),
  INDEX idx_matches_participant2 (participant2_id),
  CONSTRAINT fk_matches_round
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_participant1
    FOREIGN KEY (participant1_id) REFERENCES participants(id),
  CONSTRAINT fk_matches_participant2
    FOREIGN KEY (participant2_id) REFERENCES participants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS administrators (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  google_subject VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT '',
  picture_url VARCHAR(500) NOT NULL DEFAULT '',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_administrators_email (email),
  UNIQUE KEY uq_administrators_google_subject (google_subject)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  administrator_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  INDEX idx_admin_sessions_admin_active (administrator_id, expires_at, revoked_at),
  CONSTRAINT fk_admin_sessions_administrator
    FOREIGN KEY (administrator_id) REFERENCES administrators(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  administrator_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id, created_at),
  INDEX idx_audit_administrator (administrator_id, created_at),
  CONSTRAINT fk_audit_administrator
    FOREIGN KEY (administrator_id) REFERENCES administrators(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS data_versions (
  scope_key VARCHAR(100) NOT NULL PRIMARY KEY,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO data_versions (scope_key, version)
VALUES ('global', 1)
ON DUPLICATE KEY UPDATE scope_key = VALUES(scope_key);

INSERT INTO schema_migrations (version)
VALUES ('001_initial_schema')
ON DUPLICATE KEY UPDATE version = VALUES(version);
