import fs from 'node:fs';
import Module from 'pg-query-emscripten';

const migrationPath = new URL('../supabase/migrations/20260721031135_initial_dashboard_schema.sql', import.meta.url);
const sql = fs.readFileSync(migrationPath, 'utf8');
const parser = await new Module();
const result = parser.parse(sql);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

const requiredSecurityFragments = [
  'alter table public.profiles enable row level security',
  'create policy profiles_select',
  'private.is_active_employee()',
  'private.is_admin()',
  "bucket_id = 'work-evidence'",
  'revoke all on all tables in schema public from anon',
];

for (const fragment of requiredSecurityFragments) {
  if (!sql.includes(fragment)) {
    console.error(`Migration security check missing: ${fragment}`);
    process.exit(1);
  }
}

console.log('Migration syntax and required security controls are valid.');
