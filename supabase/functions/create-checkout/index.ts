import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_KEY  = Deno.env.get('STRIPE_SECRET_KEY')!;
const PRICE_ID    = Deno.env.get('STRIPE_PRICE_ID')!;
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  /* ── Auth: get user from JWT ── */
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  /* ── Fetch account ── */
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('id', user.id)
    .single();

  if (!profile?.account_id) return json({ error: 'No account found' }, 400);

  const { data: account } = await supabase
    .from('accounts')
    .select('id, name, stripe_customer_id, plan')
    .eq('id', profile.account_id)
    .single();

  if (!account) return json({ error: 'Account not found' }, 400);
  if (account.plan === 'pro') return json({ error: 'Already subscribed' }, 400);

  const { return_url } = await req.json().catch(() => ({ return_url: '' }));
  const base = return_url || 'https://roadbook-app.vercel.app/billing';

  /* ── Get or create Stripe customer ── */
  let customerId = account.stripe_customer_id;

  if (!customerId) {
    const cRes = await stripe('POST', '/customers', {
      email: user.email,
      name:  account.name,
      metadata: { account_id: account.id },
    });
    customerId = cRes.id;

    // Save customer ID
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    await supabaseAdmin
      .from('accounts')
      .update({ stripe_customer_id: customerId })
      .eq('id', account.id);
  }

  /* ── Create Checkout session ── */
  const session = await stripe('POST', '/checkout/sessions', {
    customer:            customerId,
    mode:                'subscription',
    line_items:          [{ price: PRICE_ID, quantity: 1 }],
    success_url:         `${base}?billing=success`,
    cancel_url:          `${base}?billing=cancelled`,
    allow_promotion_codes: 'true',
    subscription_data: {
      metadata: { account_id: account.id },
    },
    metadata: { account_id: account.id },
  });

  if (session.error) return json({ error: session.error.message }, 500);

  return json({ url: session.url });
});

/* ── Stripe REST helper ── */
async function stripe(method: string, path: string, params: Record<string, unknown>) {
  const body = new URLSearchParams();
  flattenParams(params, '', body);

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method !== 'GET' ? body.toString() : undefined,
  });
  return res.json();
}

function flattenParams(
  obj: Record<string, unknown>,
  prefix: string,
  form: URLSearchParams,
) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenParams(v as Record<string, unknown>, key, form);
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object') {
          flattenParams(item as Record<string, unknown>, `${key}[${i}]`, form);
        } else {
          form.append(`${key}[${i}]`, String(item));
        }
      });
    } else {
      form.append(key, String(v));
    }
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
