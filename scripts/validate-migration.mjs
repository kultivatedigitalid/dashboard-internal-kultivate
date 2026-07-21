import fs from 'node:fs';
import path from 'node:path';
import Module from 'pg-query-emscripten';

const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const parser = await new Module();
let sql = '';

for (const file of migrationFiles) {
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
  'begin_first_login_otp',
  'consume_first_login_otp_attempt',
  'first_login_verified_at is not null',
];

for (const fragment of requiredSecurityFragments) {
  if (!sql.includes(fragment)) {
    console.error(`Migration security check missing: ${fragment}`);
    process.exit(1);
  }
}

console.log(`${migrationFiles.length} migrations have valid syntax and required security controls.`);
