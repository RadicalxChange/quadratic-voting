-- Adds privacy_mode to Events. Default is 'anonymous'.
--
-- Existing events were created under the platform's implicit anonymity
-- contract (voter_name and vote_data scrubbed from admin responses), so we
-- set their value explicitly rather than relying on the column default.
-- The explicit UPDATE makes the intent auditable in this migration alone
-- and protects against any future change to the column default.

ALTER TABLE "public"."Events"
  ADD COLUMN privacy_mode VARCHAR NOT NULL DEFAULT 'anonymous';

UPDATE "public"."Events"
  SET privacy_mode = 'anonymous'
  WHERE privacy_mode IS NULL OR privacy_mode <> 'anonymous';
