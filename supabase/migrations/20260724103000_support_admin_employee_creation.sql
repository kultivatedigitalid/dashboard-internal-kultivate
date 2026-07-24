-- Keep employee Gmail addresses unique regardless of letter casing. The application
-- creates auth.users first, then upserts this profile; auth.users(id) remains the
-- parent for all employee foreign keys and cascades a rolled-back account cleanly.
create unique index if not exists profiles_email_lower_unique_idx
  on public.profiles (lower(email));