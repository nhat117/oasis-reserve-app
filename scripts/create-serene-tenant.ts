import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.",
  );
  process.exit(1);
}

const SALON_NAME = "Serene Nail Sanctuary";
const SLUG = "serene-nail-sanctuary";
const OWNER_EMAIL = "owner@serene-nail-sanctuary.test";
const ADMIN_EMAIL = "admin@serene-nail-sanctuary.test";
const ADMIN_PASSWORD = `Serene-${randomUUID().slice(0, 8)}!Sanctuary`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  console.log("⏳ Creating tenant…");
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .insert({ slug: SLUG, name: SALON_NAME, owner_email: OWNER_EMAIL })
    .select("id")
    .single();
  if (tenantErr) {
    console.error("❌ tenant insert:", tenantErr);
    process.exit(1);
  }
  const tenantId = tenant.id;
  console.log(`✅ tenant ${tenantId}`);

  console.log("⏳ Creating admin user…");
  const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (userErr || !newUser?.user) {
    console.error("❌ user create:", userErr);
    await supabase.from("tenants").delete().eq("id", tenantId);
    process.exit(1);
  }
  const adminId = newUser.user.id;
  console.log(`✅ admin user ${adminId}`);

  const { error: roleErr } = await supabase
    .from("user_roles")
    .insert({ user_id: adminId, role: "admin", tenant_id: tenantId });
  if (roleErr) {
    console.error("❌ role assign:", roleErr);
    process.exit(1);
  }
  console.log("✅ admin role assigned");

  const settings = [
    { key: "spa_name", value: SALON_NAME, tenant_id: tenantId },
    { key: "shop_state", value: "NSW", tenant_id: tenantId },
    { key: "shop_timezone", value: "Australia/Sydney", tenant_id: tenantId },
    { key: "random_therapist_enabled", value: "true", tenant_id: tenantId },
    { key: "show_holiday_closed", value: "true", tenant_id: tenantId },
    { key: "open_days", value: "[1,2,3,4,5,6]", tenant_id: tenantId },
    { key: "reminder_email_enabled", value: "false", tenant_id: tenantId },
    { key: "reminder_sms_enabled", value: "false", tenant_id: tenantId },
    { key: "reminder_1st_hours", value: "24", tenant_id: tenantId },
    { key: "reminder_2nd_hours", value: "1", tenant_id: tenantId },
    { key: "stripe_payment_enabled", value: "false", tenant_id: tenantId },
    { key: "membership_enabled", value: "false", tenant_id: tenantId },
    { key: "discount_codes_enabled", value: "false", tenant_id: tenantId },
  ];
  const { error: sErr } = await supabase.from("app_settings").insert(settings);
  if (sErr) console.error("⚠️ settings:", sErr.message);
  else console.log("✅ default settings seeded");

  // Seed 5 services
  const services = [
    { name: "Classic Manicure", description: "A timeless treatment with shaping, cuticle care, and polish.", duration_minutes: 30, price: 45, is_active: true, tenant_id: tenantId },
    { name: "Gel Manicure", description: "Long-lasting gel finish with chip-free wear for up to three weeks.", duration_minutes: 45, price: 65, is_active: true, tenant_id: tenantId },
    { name: "Classic Pedicure", description: "Full foot soak, exfoliation, shaping, and polish.", duration_minutes: 45, price: 55, is_active: true, tenant_id: tenantId },
    { name: "Deluxe Pedicure", description: "Extended ritual with massage, masque, and premium finish.", duration_minutes: 60, price: 85, is_active: true, tenant_id: tenantId },
    { name: "Signature Bridal", description: "Bespoke nail design for your wedding day.", duration_minutes: 75, price: 120, is_active: true, tenant_id: tenantId },
  ];
  const { error: svcErr } = await supabase.from("services").insert(services);
  if (svcErr) console.error("⚠️ services:", svcErr.message);
  else console.log(`✅ ${services.length} services seeded`);

  // Seed 3 therapists
  const therapists = [
    { name: "Isabella Chen", phone: null, email: null, start_hour: 9, end_hour: 18, break_start: 13, break_end: 14, working_days: [1, 2, 3, 4, 5, 6], is_active: true, tenant_id: tenantId },
    { name: "Amelia Tran", phone: null, email: null, start_hour: 10, end_hour: 19, break_start: 14, break_end: 15, working_days: [1, 2, 3, 4, 5, 6], is_active: true, tenant_id: tenantId },
    { name: "Sophia Nguyen", phone: null, email: null, start_hour: 9, end_hour: 17, break_start: 12, break_end: 13, working_days: [2, 3, 4, 5, 6], is_active: true, tenant_id: tenantId },
  ];
  const { error: thErr } = await supabase.from("therapists").insert(therapists);
  if (thErr) console.error("⚠️ therapists:", thErr.message);
  else console.log(`✅ ${therapists.length} therapists seeded`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Serene Nail Sanctuary tenant ready");
  console.log("=".repeat(60));
  console.log(`Tenant ID:      ${tenantId}`);
  console.log(`Slug:           ${SLUG}`);
  console.log(`Salon name:     ${SALON_NAME}`);
  console.log(`Admin email:    ${ADMIN_EMAIL}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
  console.log(`\nVITE_TENANT_ID=${tenantId}`);
})();
