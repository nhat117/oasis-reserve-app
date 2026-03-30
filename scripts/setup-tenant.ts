/**
 * Tenant Setup Script
 *
 * Creates a new tenant (salon) and its first admin user.
 * Run: npx tsx scripts/setup-tenant.ts
 *
 * This will:
 * 1. Create a tenant record
 * 2. Create an admin user in Supabase Auth
 * 3. Link the admin to the tenant via user_roles
 * 4. Seed default app_settings for the tenant
 * 5. Print the VITE_TENANT_ID to add to the frontend .env
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n🏪 Oasis Reserve — New Tenant Setup\n');

  // 1. Get Supabase credentials
  const supabaseUrl = process.env.VITE_SUPABASE_URL || await ask('Supabase URL: ');
  const serviceRoleKey = await ask('Supabase Service Role Key (from Dashboard > Settings > API): ');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Supabase URL and Service Role Key are required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 2. Collect tenant info
  console.log('\n--- Salon Details ---');
  const salonName = await ask('Salon name (e.g. "Royal Nails & Spa"): ');
  const slug = await ask('Salon slug (lowercase, no spaces, e.g. "royal-nails"): ');
  const ownerEmail = await ask('Owner email: ');

  console.log('\n--- First Admin Account ---');
  const adminEmail = await ask(`Admin email [${ownerEmail}]: `) || ownerEmail;
  const adminPassword = await ask('Admin password (min 6 chars): ');

  if (adminPassword.length < 6) {
    console.error('❌ Password must be at least 6 characters');
    process.exit(1);
  }

  // 3. Create tenant
  console.log('\n⏳ Creating tenant...');
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ slug, name: salonName, owner_email: ownerEmail })
    .select('id')
    .single();

  if (tenantErr) {
    console.error('❌ Failed to create tenant:', tenantErr.message);
    process.exit(1);
  }

  const tenantId = tenant.id;
  console.log(`✅ Tenant created: ${tenantId}`);

  // 4. Create admin user
  console.log('⏳ Creating admin user...');
  const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (userErr) {
    console.error('❌ Failed to create user:', userErr.message);
    // Clean up tenant
    await supabase.from('tenants').delete().eq('id', tenantId);
    process.exit(1);
  }

  console.log(`✅ Admin user created: ${newUser.user.id}`);

  // 5. Assign admin role with tenant
  const { error: roleErr } = await supabase
    .from('user_roles')
    .insert({ user_id: newUser.user.id, role: 'admin', tenant_id: tenantId });

  if (roleErr) {
    console.error('❌ Failed to assign role:', roleErr.message);
    process.exit(1);
  }

  console.log('✅ Admin role assigned');

  // 6. Seed default app_settings for this tenant
  console.log('⏳ Seeding default settings...');
  const defaultSettings = [
    { key: 'spa_name', value: salonName, tenant_id: tenantId },
    { key: 'shop_state', value: 'VIC', tenant_id: tenantId },
    { key: 'shop_timezone', value: 'Australia/Melbourne', tenant_id: tenantId },
    { key: 'random_therapist_enabled', value: 'true', tenant_id: tenantId },
    { key: 'show_holiday_closed', value: 'true', tenant_id: tenantId },
    { key: 'open_days', value: '1,2,3,4,5,6', tenant_id: tenantId },
    { key: 'reminder_email_enabled', value: 'false', tenant_id: tenantId },
    { key: 'reminder_sms_enabled', value: 'false', tenant_id: tenantId },
    { key: 'reminder_1st_hours', value: '24', tenant_id: tenantId },
    { key: 'reminder_2nd_hours', value: '1', tenant_id: tenantId },
    { key: 'stripe_payment_enabled', value: 'false', tenant_id: tenantId },
    { key: 'membership_enabled', value: 'false', tenant_id: tenantId },
    { key: 'discount_codes_enabled', value: 'false', tenant_id: tenantId },
  ];

  const { error: settingsErr } = await supabase.from('app_settings').insert(defaultSettings);
  if (settingsErr) {
    console.error('⚠️  Settings seed warning:', settingsErr.message);
  } else {
    console.log('✅ Default settings created');
  }

  // 7. Print result
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Tenant setup complete!\n');
  console.log(`Tenant ID:    ${tenantId}`);
  console.log(`Tenant Slug:  ${slug}`);
  console.log(`Salon Name:   ${salonName}`);
  console.log(`Admin Email:  ${adminEmail}`);
  console.log('\n--- Add to your frontend .env ---');
  console.log(`VITE_TENANT_ID=${tenantId}`);
  console.log('='.repeat(50) + '\n');

  rl.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
