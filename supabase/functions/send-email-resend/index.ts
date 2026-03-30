import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const { to, subject, html, from_name, from_email } = await req.json()

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Resend API key from app_settings
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: apiKeySetting, error: settingError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'resend_api_key')
      .single()

    if (settingError || !apiKeySetting?.value) {
      console.error('Resend API key not configured', settingError)
      return new Response(
        JSON.stringify({ error: 'Resend API key not configured. Please set it in admin dashboard settings.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resendApiKey = apiKeySetting.value

    // Get sender email and spa name from settings
    const { data: senderSettings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['resend_from_email', 'spa_name'])

    const settingsMap: Record<string, string> = {}
    senderSettings?.forEach((r: any) => { settingsMap[r.key] = r.value })

    const senderEmail = from_email || settingsMap.resend_from_email || 'onboarding@resend.dev'
    const senderName = from_name || settingsMap.spa_name || 'Oasis Reserve'

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        subject,
        html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('Resend API error:', resendData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: resendData }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Email sent via Resend:', resendData)
    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
