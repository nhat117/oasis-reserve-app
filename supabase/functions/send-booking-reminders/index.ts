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

  // Get tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Fetch confirmed bookings for tomorrow that have an email
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, customer_name, customer_email, booking_date, start_time, service_id, therapist_id, services(name), therapists(name)')
    .eq('booking_date', tomorrowStr)
    .eq('status', 'confirmed')
    .not('customer_email', 'is', null)

  if (error) {
    console.error('Failed to fetch bookings', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch bookings' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let sent = 0
  for (const booking of (bookings || [])) {
    if (!booking.customer_email) continue

    const serviceName = (booking as any).services?.name || ''
    const therapistName = (booking as any).therapists?.name || ''

    await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'booking-reminder',
        recipientEmail: booking.customer_email,
        idempotencyKey: `booking-reminder-${booking.id}-${tomorrowStr}`,
        templateData: {
          customerName: booking.customer_name,
          serviceName,
          therapistName,
          bookingDate: tomorrowStr.split('-').reverse().join('/'),
          startTime: booking.start_time?.substring(0, 5),
        },
      },
    })
    sent++
  }

  console.log(`Sent ${sent} reminder emails for ${tomorrowStr}`)
  return new Response(JSON.stringify({ success: true, sent, date: tomorrowStr }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
