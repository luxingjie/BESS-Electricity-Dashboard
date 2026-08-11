-- Add the wind/solar mechanism price topic (NDRC Document No. 136 of 2025)
-- to the China province topic atlas.
--
-- Postgres cannot use a newly added enum value inside the same transaction,
-- so the validation function updates live in the follow-up migration.

alter type public.province_topic_id add value 'renewable-mechanism-price';
