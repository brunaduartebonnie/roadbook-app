import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const STRIPE_KEY     = Deno.env.get('STRIPE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  const sig  = req.headers.get('stripe-signature') ?? '';
  const body = await req.text();

  /* ── Verify signature ── */
  if (!await verifyStripeSignature(body, sig, WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  const obj   = event.data.object;

  switch (event.type) {

    /* Checkout completed → subscription activated */
    case 'checkout.session.completed': {
      const accountId = obj.metadata?.account_id;
      if (!accountId) break;

      await supabase.from('accounts').update({
        plan:                   'pro',
        stripe_customer_id:     obj.customer,
        stripe_subscription_id: obj.subscription,
      }).eq('id', accountId);
      break;
    }

    /* Subscription updated (renewal, plan change) */
    case 'customer.subscription.updated': {
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('stripe_subscription_id', obj.id)
        .single();

      if (!account) {
        // Try via customer ID
        const { data: acct2 } = await supabase
          .from('accounts')
          .select('id')
          .eq('stripe_customer_id', obj.customer)
          .single();
        if (!acct2) break;

        await updateSubscription(acct2.id, obj);
        break;
      }
      await updateSubscription(account.id, obj);
      break;
    }

    /* Subscription cancelled */
    case 'customer.subscription.deleted': {
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('stripe_subscription_id', obj.id)
        .single();

      if (account) {
        await supabase.from('accounts').update({
          plan:                   'cancelled',
          stripe_subscription_id: null,
          current_period_end:     null,
        }).eq('id', account.id);
      }
      break;
    }

    /* Payment failed */
    case 'invoice.payment_failed': {
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('stripe_customer_id', obj.customer)
        .single();

      if (account) {
        await supabase.from('accounts').update({
          plan: 'past_due',
        }).eq('id', account.id);
      }
      break;
    }
  }

  return new Response('ok', { status: 200 });
});

async function updateSubscription(accountId: string, sub: Record<string, unknown>) {
  const status = sub.status as string;
  const plan   = status === 'active' || status === 'trialing' ? 'pro' : 'cancelled';
  const periodEnd = sub.current_period_end as number;

  await supabase.from('accounts').update({
    plan,
    stripe_subscription_id: sub.id,
    current_period_end:     periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  }).eq('id', accountId);
}

/* ── Stripe webhook signature verification ── */
async function verifyStripeSignature(
  payload: string,
  header:  string,
  secret:  string,
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      header.split(',').map(p => p.split('=')),
    ) as { t: string; v1: string };

    const signedPayload = `${parts.t}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signedPayload),
    );
    const computed = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time compare
    return computed === parts.v1;
  } catch {
    return false;
  }
}
