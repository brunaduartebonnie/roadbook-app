import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('id', user.id)
    .single();

  const { data: account } = await supabase
    .from('accounts')
    .select('stripe_customer_id')
    .eq('id', profile?.account_id)
    .single();

  if (!account?.stripe_customer_id) return json({ error: 'No Stripe customer' }, 400);

  const { return_url } = await req.json().catch(() => ({ return_url: '' }));

  const body = new URLSearchParams({
    customer:   account.stripe_customer_id,
    return_url: return_url || 'https://roadbook-app.vercel.app/billing',
  });

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const session = await res.json();
  if (!res.ok) return json({ error: session.error?.message }, 500);

  return json({ url: session.url });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
