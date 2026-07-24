import fs from 'node:fs';

import Module from 'pg-query-emscripten';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();
let sql = '';

for (const file of migrationFiles) {
  const parser = await new Module();
  const migrationSql = fs.readFileSync(new URL(file, migrationsDir), 'utf8');
  const result = parser.parse(migrationSql);
  if (result.error) {
    console.error(`${file}: ${result.error}`);
    process.exit(1);
  }
  sql += `\n${migrationSql}`;
}

const requiredSecurityFragments = [
  'alter table public.profiles enable row level security',
  'create policy profiles_select',
  'private.is_active_employee()',
  'private.is_admin()',
  "bucket_id = 'work-evidence'",
  'revoke all on all tables in schema public from anon',
  'private.login_otp_challenges',
  'private.login_otp_verifications',
  'is_current_session_otp_verified',
  'begin_login_otp',
  'consume_login_otp_attempt',
  'complete_login_otp',
  "auth.jwt() ->> 'session_id'",
  'grant execute on function public.complete_login_otp(uuid, uuid) to service_role',
  'create table public.task_assignees',
  'alter table public.task_assignees enable row level security',
  'create policy task_assignees_select',
  'private.is_task_assignee',
  'public.admin_delete_task',
  'public.update_task_progress(uuid, integer)',
  'drop table if exists public.allowances cascade',
  'drop policy if exists evidence_delete on storage.objects',
];

for (const fragment of requiredSecurityFragments) {
  if (!sql.includes(fragment)) {
    console.error(`Migration security check missing: ${fragment}`);
    process.exit(1);
  }
}

console.log(`${migrationFiles.length} migrations have valid syntax and required security controls.`);
