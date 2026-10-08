-- Apply once to databases that do not yet have these columns.
ALTER TABLE events ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE email_queue ADD COLUMN entity_type VARCHAR(50) NULL DEFAULT 'event';
