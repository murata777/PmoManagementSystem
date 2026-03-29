/**
 * SQL expression for PostgreSQL. Expects users joined as `u`.
 * When name is empty, equals email, or contains @, avoid showing a full email in UI.
 */
module.exports = `CASE
  WHEN u.id IS NULL THEN NULL
  WHEN TRIM(COALESCE(u.name, '')) = '' THEN '—'
  WHEN TRIM(COALESCE(u.email, '')) <> '' AND LOWER(TRIM(u.name)) = LOWER(TRIM(u.email))
    THEN SPLIT_PART(TRIM(u.email), '@', 1)
  WHEN POSITION('@' IN TRIM(u.name)) > 0 THEN SPLIT_PART(TRIM(u.name), '@', 1)
  ELSE TRIM(u.name)
END`;
