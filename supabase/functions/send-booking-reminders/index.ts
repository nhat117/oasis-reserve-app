import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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

  // Get reminder intervals (hours before appointment)
  const { data: interval1Setting } = await supabase
    .from('app_settings').select('value').eq('key', 'reminder_1st_hours').single()
  const { data: interval2Setting } = await supabase
    .from('app_settings').select('value').eq('key', 'reminder_2nd_hours').single()

  const reminder1Hours = parseInt(interval1Setting?.value || '24')
  const reminder2Hours = parseInt(interval2Setting?.value || '1')

  const now = new Date()
  let sent = 0

  // Process each reminder interval
  for (const hoursAhead of [reminder1Hours, reminder2Hours]) {
    if (hoursAhead <= 0) continue

    const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)
    const targetDate = targetTime.toISOString().split('T')[0]
    const targetHour = targetTime.getUTCHours().toString().padStart(2, '0')
    const targetMinute = targetTime.getUTCMinutes().toString().padStart(2, '0')
    
    // Find bookings within a 30-min window around the target time
    const windowStart = `${targetHour}:${targetMinute}:00`
    const windowEndTime = new Date(targetTime.getTime() + 30 * 60 * 1000)
    const windowEndHour = windowEndTime.getUTCHours().toString().padStart(2, '0')
    const windowEndMinute = windowEndTime.getUTCMinutes().toString().padStart(2, '0')
    const windowEnd = `${windowEndHour}:${windowEndMinute}:00`

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
