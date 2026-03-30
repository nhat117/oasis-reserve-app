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

  // Check if email reminders are enabled
  const { data: enabledSetting } = await supabase
    .from('app_settings').select('value').eq('key', 'reminder_email_enabled').single()
  
  if (enabledSetting?.value !== 'true') {
    return new Response(JSON.stringify({ skipped: true, reason: 'Email reminders disabled' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Get reminder intervals (hours before appointment) and shop timezone
  const { data: reminderSettings } = await supabase
    .from('app_settings').select('key, value')
    .in('key', ['reminder_1st_hours', 'reminder_2nd_hours', 'shop_timezone'])

  const settingsMap: Record<string, string> = {}
  reminderSettings?.forEach((r: any) => { settingsMap[r.key] = r.value })

  const reminder1Hours = parseInt(settingsMap.reminder_1st_hours || '24')
  const reminder2Hours = parseInt(settingsMap.reminder_2nd_hours || '1')
  const shopTimezone = settingsMap.shop_timezone || 'Australia/Melbourne'

  const now = new Date()
  let sent = 0

  // Helper: format a Date in the shop's local timezone
  const toLocalDate = (d: Date): string =>
    d.toLocaleDateString('en-CA', { timeZone: shopTimezone }) // YYYY-MM-DD

  const formatLocalTime = (d: Date): string => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: shopTimezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d)
    const h = parts.find(p => p.type === 'hour')?.value || '00'
    const m = parts.find(p => p.type === 'minute')?.value || '00'
    return `${h}:${m}`
  }

  // Process each reminder interval
  for (const hoursAhead of [reminder1Hours, reminder2Hours]) {
    if (hoursAhead <= 0) continue

    const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
    const targetDate = toLocalDate(targetTime)

    // Find bookings within a 30-min window around the target time (in shop local time)
    const windowStart = formatLocalTime(targetTime) + ':00'
    const windowEndTime = new Date(targetTime.getTime() + 30 * 60 * 1000)
    const windowEnd = formatLocalTime(windowEndTime) + ':00'

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_email, booking_date, start_time, service_id, therapist_id, services(name), therapists(name)')
      .eq('booking_date', targetDate)
      .eq('status', 'confirmed')
      .gte('start_time', windowStart)
      .lt('start_time', windowEnd)
      .not('customer_email', 'is', null)

    if (error) {
      console.error('Failed to fetch bookings', error)
      continue
    }

    for (const booking of (bookings || [])) {
      if (!booking.customer_email) continue

      const serviceName = (booking as any).services?.name || ''
      const therapistName = (booking as any).therapists?.name || ''
      const reminderLabel = hoursAhead >= 24 ? `${hoursAhead / 24}d` : `${hoursAhead}h`

      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'booking-reminder',
            recipientEmail: booking.customer_email,
            idempotencyKey: `booking-reminder-${reminderLabel}-${booking.id}-${targetDate}`,
            templateData: {
              customerName: booking.customer_name,
              serviceName,
              therapistName,
              bookingDate: booking.booking_date.split('-').reverse().join('/'),
              startTime: booking.start_time?.substring(0, 5),
            },
          },
        })
        sent++
      } catch (e) {
        console.error(`Failed to send reminder for booking ${booking.id}:`, e)
      }
    }
  }

  console.log(`Sent ${sent} reminder emails`)
  return new Response(JSON.stringify({ success: true, sent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
