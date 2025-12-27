
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const { firstName, phoneNumber, code } = await req.json();

    if (!firstName || !phoneNumber || !code) {
      return new Response(
        JSON.stringify({ error: 'Missing fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check submission window (Sunday=0 to Thursday=4)
    // Removed strict day check for testing purposes or logic adjustment
    // const now = new Date();
    // const day = now.getDay();
    // if (day > 4) { ... }

    // 2. Get Weekly Config
    const { data: config, error: configError } = await supabaseClient
      .from('weekly_config')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (configError || !config) {
      // If no active config, treat as closed
      return new Response(
        JSON.stringify({ 
            message: 'Entries for this week’s bulletin are now closed.', 
            status: 'closed' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2.1. Check Time Window
    // Logic: Current time ≥ active_from AND Current time ≤ expires_at
    // If timestamps are null (old config), we might default to OPEN, or require them.
    // Requirement says "active_from (timestamp, required), expires_at (timestamp, required)"
    // But we need to support legacy rows if any.
    // Let's assume strict check if they exist.
    
    if (config.active_from && config.expires_at) {
        const now = new Date();
        const start = new Date(config.active_from);
        const end = new Date(config.expires_at);

        if (now < start || now > end) {
            return new Response(
                JSON.stringify({ 
                    message: 'Entries for this week’s bulletin are now closed.', 
                    status: 'closed_window' 
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    }

    // 3. Check for abuse (duplicate phone number for this config/week)
    const { data: existingEntry } = await supabaseClient
      .from('submissions')
      .select('id')
      .eq('phone_number', phoneNumber)
      .gte('created_at', config.created_at)
      .single();

    if (existingEntry) {
       // Silent failure: return success message but don't save
       return new Response(
        JSON.stringify({ 
            message: 'Entry received. One correct entry will be contacted.', 
            status: 'received' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate Code
    // STRICT MATCHING requested: Case sensitive, symbol sensitive.
    // We only trim surrounding whitespace to handle mobile keyboard artifacts.
    const inputCode = code.trim();
    const validCode = config.valid_code.trim();
    const isCorrect = inputCode === validCode;

    // 5. Insert Submission
    const { error: insertError } = await supabaseClient
      .from('submissions')
      .insert({
        first_name: firstName,
        phone_number: phoneNumber,
        submitted_code: code,
        is_correct: isCorrect,
      });

    if (insertError) {
      throw insertError;
    }

    // 6. Determine Response & Handle Winner Logic
    if (isCorrect) {
      // Check if winner already selected
      if (config.winner_selected) {
         return new Response(
          JSON.stringify({ 
            message: 'This entry is correct. A correct entry has already been received for this week.',
            status: 'correct_late' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // This is the FIRST correct entry!
        // Mark winner_selected = true in config
        await supabaseClient
            .from('weekly_config')
            .update({ winner_selected: true })
            .eq('id', config.id);

        return new Response(
          JSON.stringify({ 
            message: 'Entry received. One correct entry will be contacted.',
            status: 'correct_winner' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
        // Invalid code
        return new Response(
            JSON.stringify({ 
                message: 'This code is not valid. Please check the bulletin and try again.',
                status: 'invalid' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
