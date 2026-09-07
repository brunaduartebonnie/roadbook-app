import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'RoadBook <noreply@roadbook.pt>';

const ROLE_LABELS: Record<string, string> = {
  tour_manager: 'Tour Manager',
  artist:       'Artista',
  crew:         'Crew',
  backline:     'Backline',
  production:   'Produção',
  admin:        'Admin',
};

function buildEmail(p: {
  band_name:  string;
  band_color: string;
  role:       string;
  invite_url: string;
  expires_at: string;
}): string {
  const roleLabel  = ROLE_LABELS[p.role] ?? p.role;
  const expiryDate = new Date(p.expires_at).toLocaleDateString('pt-PT', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Convite RoadBook</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ef;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">

        <!-- LOGO -->
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:26px;font-weight:900;letter-spacing:3px;color:#1a1817;">ROAD</span>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fe4d5e;margin:0 6px 3px;vertical-align:middle;"></span>
          <span style="font-size:26px;font-weight:900;letter-spacing:3px;color:#fe4d5e;">BOOK</span>
          <div style="font-size:9px;letter-spacing:4px;color:#8a7f70;text-transform:uppercase;margin-top:6px;">Tour Management &amp; Produção</div>
        </td></tr>

        <!-- CARD -->
        <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Band colour bar -->
          <div style="height:5px;background:${p.band_color};"></div>

          <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 36px 32px;">

            <!-- Icon + heading -->
            <tr><td style="text-align:center;padding-bottom:28px;">
              <div style="font-size:48px;margin-bottom:16px;">🎤</div>
              <div style="font-size:28px;font-weight:900;letter-spacing:2px;color:#1a1817;line-height:1.15;">FOSTE<br>CONVIDADO</div>
              <div style="width:40px;height:2px;background:#fe4d5e;margin:16px auto 0;border-radius:2px;"></div>
            </td></tr>

            <!-- Band pill -->
            <tr><td style="text-align:center;padding-bottom:8px;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;background:#f0ede6;border:1px solid #d8d3c8;border-radius:30px;padding:8px 18px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <div style="width:10px;height:10px;border-radius:50%;background:${p.band_color};"></div>
                  </td>
                  <td style="font-size:14px;font-weight:700;color:#1a1817;letter-spacing:0.3px;">${p.band_name}</td>
                </tr>
              </table>
            </td></tr>

            <!-- Role pill -->
            <tr><td style="text-align:center;padding-bottom:32px;">
              <span style="display:inline-block;background:rgba(34,89,224,0.1);border:1px solid rgba(34,89,224,0.2);border-radius:20px;padding:4px 14px;font-size:11px;font-weight:700;color:#2259e0;letter-spacing:0.5px;text-transform:uppercase;">${roleLabel}</span>
            </td></tr>

            <!-- CTA -->
            <tr><td style="text-align:center;padding-bottom:24px;">
              <a href="${p.invite_url}"
                 style="display:inline-block;background:#2259e0;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:2px;text-decoration:none;padding:16px 40px;border-radius:14px;text-transform:uppercase;">
                Aceitar Convite
              </a>
            </td></tr>

            <!-- Expiry -->
            <tr><td style="text-align:center;padding-bottom:24px;">
              <div style="font-size:12px;color:#8a7f70;line-height:1.6;">
                Link válido até <strong style="color:#1a1817;">${expiryDate}</strong>
              </div>
            </td></tr>

            <!-- Divider -->
            <tr><td style="border-top:1px solid #e8e4dc;padding-top:20px;">
              <div style="font-size:11px;color:#bbb5a8;text-align:center;line-height:1.7;">
                Se não pediste este convite, podes ignorar este email.<br>
                Nenhuma ação é necessária.
              </div>
            </td></tr>

          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="text-align:center;padding-top:28px;">
          <div style="font-size:11px;color:#bbb5a8;letter-spacing:0.5px;">
            &copy; 2026 RoadBook &mdash; Tour Management &amp; Produção
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: {
    to:         string;
    band_name:  string;
    band_color: string;
    role:       string;
    invite_url: string;
    expires_at: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const html = buildEmail({
    band_name:  body.band_name  ?? 'a banda',
    band_color: body.band_color ?? '#2259e0',
    role:       body.role       ?? 'member',
    invite_url: body.invite_url,
    expires_at: body.expires_at,
  });

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      [body.to],
      subject: `Convite para ${body.band_name} — RoadBook`,
      html,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
