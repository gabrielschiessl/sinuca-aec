ALTER TABLE matches
  ADD COLUMN scheduled_date DATE NULL AFTER participant2_id,
  ADD COLUMN scheduled_time TIME NULL AFTER scheduled_date;

INSERT INTO schema_migrations (version)
VALUES ('002_match_schedule')
ON DUPLICATE KEY UPDATE version = VALUES(version);

