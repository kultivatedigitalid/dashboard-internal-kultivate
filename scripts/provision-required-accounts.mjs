import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadLocalEnv() {
  if (!fs.existsSync('.env.local')) return;
  for (const line of fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!process.env[key]) process.env[key] = line.slice(separator + 1).trim();
  }
}

loadLocalEnv();

const url = process.env.PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('PUBLIC_SUPABASE_URL dan SUPABASE_SECRET_KEY wajib dikonfigurasi.');

const accounts = [
  { fullName: 'Joshua Wijaya', email: 'joshuawijaya949@gmail.com', employeeCode: 'KDI-JW', role: 'employee', passwordEnv: 'JOSHUA_PASSWORD' },
  { fullName: 'Airin Frantrishia Lay', email: 'airin.frantrishia@gmail.com', employeeCode: 'KDI-AF', role: 'employee', passwordEnv: 'AIRIN_PASSWORD' },
  { fullName: 'Davis Ariel', email: 'davisariel432@gmail.com', employeeCode: 'KDI-DA', role: 'employee', passwordEnv: 'DAVIS_PASSWORD' },
  { fullName: 'Kultivate Digital ID Admin', email: 'kultivatedigitalid@gmail.com', employeeCode: null, role: 'admin', passwordEnv: 'ADMIN_PASSWORD' },
];

const missing = accounts.filter((account) => !process.env[account.passwordEnv]).map((account) => account.passwordEnv);
if (missing.length) throw new Error(`Password environment variables belum diisi: ${missing.join(', ')}`);

const service = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: usersPage, error: listError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

for (const account of accounts) {
  const existing = usersPage.users.find((user) => user.email?.toLowerCase() === account.email);
  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await service.auth.admin.createUser({
      email: account.email,
      password: process.env[account.passwordEnv],
      email_confirm: true,
      app_metadata: { app_role: account.role },
      user_metadata: { full_name: account.fullName, employee_code: account.employeeCode },
    });
    if (error || !data.user) throw error ?? new Error(`Gagal membuat ${account.email}`);
    userId = data.user.id;
  } else {
    const { error } = await service.auth.admin.updateUserById(userId, {
      app_metadata: { app_role: account.role },
      user_metadata: { full_name: account.fullName, employee_code: account.employeeCode },
    });
    if (error) throw error;
  }

  const { error: profileError } = await service.from('profiles').upsert({
    id: userId,
    email: account.email,
    full_name: account.fullName,
    employee_code: account.employeeCode,
    role: account.role,
    is_active: true,
    first_login_verified_at: null,
  }, { onConflict: 'id' });
  if (profileError) throw profileError;
  console.log(`Provisioned ${account.role}: ${account.email}`);
}
