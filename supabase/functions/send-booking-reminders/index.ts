import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Auth: allow service_role key (for cron) or admin/employee user
  const authHeader = req.headers.get('authorization')
  const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`

  if (!isServiceRole) {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const authAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const callerClient = createClient(supabaseUrl, authAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller } } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: isAdmin } = await callerClient.rpc('has_role', { _user_id: caller.id, _role: 'admin' })
    const { data: isEmployee } = await callerClient.rpc('has_role', { _user_id: caller.id, _role: 'employee' })
    if (!isAdmin && !isEmployee) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get all active tenants
  const { data: tenants } = await supabase
    .from('tenants').select('id').eq('is_active', true)

  const now = new Date()
  let totalSent = 0

  for (const tenant of (tenants || [])) {
    const tid = tenant.id

    // Check if email reminders are enabled for this tenant
    const { data: enabledSetting } = await supabase
      .from('app_settings').select('value')
      .eq('key', 'reminder_email_enabled').eq('tenant_id', tid).single()

    if (enabledSetting?.value !== 'true') continue

    // Get tenant-specific settings
    const { data: reminderSettings } = await supabase
      .from('app_settings').select('key, value')
      .eq('tenant_id', tid)
      .in('key', ['reminder_1st_hours', 'reminder_2nd_hours', 'shop_timezone', 'spa_name'])

    const settingsMap: Record<string, string> = {}
    reminderSettings?.forEach((r: any) => { settingsMap[r.key] = r.value })

    const reminder1Hours = parseInt(settingsMap.reminder_1st_hours || '24')
    const reminder2Hours = parseInt(settingsMap.reminder_2nd_hours || '1')
    const shopTimezone = settingsMap.shop_timezone || 'Australia/Melbourne'
    const spaName = settingsMap.spa_name || 'Oasis Reserve'

    // Helper: format a Date in the shop's local timezone
    const toLocalDate = (d: Date): string =>
      d.toLocaleDateString('en-CA', { timeZone: shopTimezone })

    const formatLocalTime = (d: Date): string => {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: shopTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
      const h = parts.find(p => p.type === 'hour')?.value || '00'
      const m = parts.find(p => p.type === 'minute')?.value || '00'
      return `${h}:${m}`
    }

    for (const hoursAhead of [reminder1Hours, reminder2Hours]) {
      if (hoursAhead <= 0) continue

      const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
      const targetDate = toLocalDate(targetTime)
      const windowStart = formatLocalTime(targetTime) + ':00'
      const windowEndTime = new Date(targetTime.getTime() + 30 * 60 * 1000)
      const windowEnd = formatLocalTime(windowEndTime) + ':00'

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, customer_name, customer_email, booking_date, start_time, service_id, therapist_id, services(name), therapists(name)')
        .eq('tenant_id', tid)
        .eq('booking_date', targetDate)
        .eq('status', 'confirmed')
        .gte('start_time', windowStart)
        .lt('start_time', windowEnd)
        .not('customer_email', 'is', null)

      if (error) {
        console.error(`[${tid}] Failed to fetch bookings`, error)
        continue
      }

      for (const booking of (bookings || [])) {
        if (!booking.customer_email) continue

        const serviceName = (booking as any).services?.name || ''
        const therapistName = (booking as any).therapists?.name || ''
        const displayDate = booking.booking_date.split('-').reverse().join('/')
        const displayTime = booking.start_time?.substring(0, 5) || ''
        const customerDisplay = booking.customer_name || 'Quý khách'

        try {
          const html = `
<div style="background-color:#ffffff;font-family:'Be Vietnam Pro',Arial,sans-serif">
  <div style="padding:20px 25px;max-width:520px;margin:0 auto">
    <div style="background-color:hsl(30,35%,28%);border-radius:12px 12px 0 0;padding:24px;text-align:center">
      <h1 style="font-size:22px;font-weight:bold;color:#ffffff;margin:0">⏰ Nhắc Lịch Hẹn</h1>
    </div>
    <p style="font-size:16px;color:hsl(25,30%,12%);margin:20px 0 8px">Xin chào ${customerDisplay},</p>
    <p style="font-size:14px;color:hsl(25,15%,45%);line-height:1.6;margin:0 0 16px">Đây là lời nhắc lịch hẹn của bạn tại <strong>${spaName}</strong>:</p>
    <div style="background-color:hsl(35,30%,95%);border-radius:8px;padding:16px;margin:0 0 20px">
      <p style="font-size:14px;color:hsl(25,30%,12%);margin:4px 0;line-height:1.6">📋 <strong>Dịch vụ:</strong> ${serviceName || 'N/A'}</p>
      <p style="font-size:14px;color:hsl(25,30%,12%);margin:4px 0;line-height:1.6">👤 <strong>Thợ:</strong> ${therapistName || 'N/A'}</p>
      <p style="font-size:14px;color:hsl(25,30%,12%);margin:4px 0;line-height:1.6">📅 <strong>Ngày:</strong> ${displayDate}</p>
      <p style="font-size:14px;color:hsl(25,30%,12%);margin:4px 0;line-height:1.6">🕐 <strong>Giờ:</strong> ${displayTime}</p>
    </div>
    <p style="font-size:14px;color:hsl(25,15%,45%);line-height:1.6;margin:0 0 16px">Vui lòng đến đúng giờ. Nếu cần thay đổi, hãy liên hệ chúng tôi sớm nhất có thể.</p>
    <hr style="border-color:hsl(35,20%,85%);margin:20px 0" />
    <p style="font-size:12px;color:hsl(25,15%,45%);margin:0">Trân trọng, ${spaName}</p>
  </div>
</div>`

          await supabase.functions.invoke('send-email-resend', {
            body: {
              to: booking.customer_email,
              subject: `Nhắc lịch hẹn – ${serviceName} ${displayDate} lúc ${displayTime}`,
              html,
            },
          })
          totalSent++
        } catch (e) {
          console.error(`[${tid}] Failed to send reminder for booking ${booking.id}:`, e)
        }
      }
    }
  }

  console.log(`Sent ${totalSent} reminder emails across ${tenants?.length || 0} tenants`)
  return new Response(JSON.stringify({ success: true, sent: totalSent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
