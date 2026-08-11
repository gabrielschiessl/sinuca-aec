SET NAMES utf8mb4;

SET @drop_old_participant_index = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'participants'
      AND index_name = 'uq_participants_player'
  ),
  'ALTER TABLE participants DROP INDEX uq_participants_player',
  'SELECT 1'
);
PREPARE participant_index_statement FROM @drop_old_participant_index;
EXECUTE participant_index_statement;
DEALLOCATE PREPARE participant_index_statement;

SET @add_participant_index = IF(
  NOT EXISTS(
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'participants'
      AND index_name = 'idx_participants_season_player'
  ),
  'ALTER TABLE participants ADD INDEX idx_participants_season_player (season_id, player_id)',
  'SELECT 1'
);
PREPARE participant_index_statement FROM @add_participant_index;
EXECUTE participant_index_statement;
DEALLOCATE PREPARE participant_index_statement;

INSERT INTO schema_migrations (version)
VALUES ('003_participant_swaps')
ON DUPLICATE KEY UPDATE version = VALUES(version);
