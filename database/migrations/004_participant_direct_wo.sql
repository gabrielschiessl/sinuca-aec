ALTER TABLE participants
  ADD COLUMN direct_wo TINYINT(1) NOT NULL DEFAULT 0
  AFTER tiebreak_priority;
