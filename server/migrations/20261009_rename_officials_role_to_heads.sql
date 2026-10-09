-- Run once to make "heads" the canonical role name.
-- If a "heads" role already exists, retain it and move all role references
-- from "officials" before removing the duplicate role row.
START TRANSACTION;

SET @heads_role_id = (SELECT id FROM roles WHERE name = 'heads' LIMIT 1);
SET @officials_role_id = (SELECT id FROM roles WHERE name = 'officials' LIMIT 1);

UPDATE user_profile
SET role_id = @heads_role_id
WHERE role_id = @officials_role_id
  AND @heads_role_id IS NOT NULL;

UPDATE account_codes
SET role_id = @heads_role_id
WHERE role_id = @officials_role_id
  AND @heads_role_id IS NOT NULL;

UPDATE account_code_requests
SET role_id = @heads_role_id
WHERE role_id = @officials_role_id
  AND @heads_role_id IS NOT NULL;

UPDATE profile_change_requests
SET requested_role_id = @heads_role_id
WHERE requested_role_id = @officials_role_id
  AND @heads_role_id IS NOT NULL;

UPDATE roles
SET name = 'heads'
WHERE id = @officials_role_id
  AND @heads_role_id IS NULL;

DELETE FROM roles
WHERE id = @officials_role_id
  AND @heads_role_id IS NOT NULL;

COMMIT;
