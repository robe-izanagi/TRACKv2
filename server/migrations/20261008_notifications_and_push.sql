ALTER TABLE notifications
  MODIFY COLUMN type ENUM(
    'event_invite', 'event_update', 'event_collaborator', 'event_response', 'event_reminder',
    'event_archived', 'event_deleted', 'event_attendee_removed', 'event_collaborator_removed',
    'event_attachment_added', 'event_venue_changed', 'event_venue_archived',
    'task_invite', 'task_update', 'task_collaborator', 'task_response', 'task_reminder',
    'task_archived', 'task_deleted', 'task_assignee_removed', 'task_collaborator_removed',
    'task_checklist_completed', 'task_checklist_reopened', 'task_checklist_comment',
    'task_attachment_added',
    'profile_change_approved', 'profile_change_rejected', 'system'
  ) NOT NULL;

ALTER TABLE email_queue
  ADD COLUMN in_app_notified_at DATETIME NULL AFTER sent_at;

CREATE TABLE push_subscriptions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  endpoint_hash VARCHAR(64) NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_push_subscriptions_user_id (user_id)
);
