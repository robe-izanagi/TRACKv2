-- Apply once to enable notification restore/undo.
ALTER TABLE notifications
  ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
