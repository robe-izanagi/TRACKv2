-- Store the profile values that existed when a change request was submitted.
ALTER TABLE profile_change_requests
  ADD COLUMN previous_values_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN previous_department_id CHAR(36) NULL,
  ADD COLUMN previous_office_id CHAR(36) NULL,
  ADD COLUMN previous_role_id CHAR(36) NULL,
  ADD COLUMN previous_position_id CHAR(36) NULL;

UPDATE profile_change_requests AS request
JOIN user_profile AS profile ON profile.user_id = request.user_id
SET request.previous_values_recorded = TRUE,
    request.previous_department_id = profile.department_id,
    request.previous_office_id = profile.office_id,
    request.previous_role_id = profile.role_id,
    request.previous_position_id = profile.position_id
WHERE request.status = 'pending';
