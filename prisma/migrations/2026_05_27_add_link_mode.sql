-- Adds link_mode to Events. Default is 'unique' (today's per-voter-link
-- behavior). The 'public' value enables a single shareable URL for the
-- event with no per-voter pre-allocation.
--
-- Existing events were created under the unique-link contract — voters
-- received personal links generated from pre-allocated Voters rows — so
-- we set their value explicitly rather than relying on the column default.
-- Same auditable pattern as 2026_05_27_add_privacy_mode.sql.

ALTER TABLE "public"."Events"
  ADD COLUMN link_mode VARCHAR NOT NULL DEFAULT 'unique';

UPDATE "public"."Events"
  SET link_mode = 'unique'
  WHERE link_mode IS NULL OR link_mode <> 'unique';
