import nodemailer from 'nodemailer';

// Sem SMTP_HOST/PORT/USER/PASS configurados, o app segue funcionando normalmente — só o fluxo
// de "esqueci minha senha" (o único que depende de email) retorna um erro claro em vez de travar
// silenciosamente. Mesmo padrão do provedor de IA opcional (ver services/ai/index.js).
let transporter;

function getTransporter() {
  if (transporter !== undefined) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // 465 = SSL implícito; 587/outras usam STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(getTransporter());
}

export function requireEmailConfigured() {
  if (!isEmailConfigured()) {
    const err = new Error(
      'Envio de email não está configurado. Defina SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS em server/.env para habilitar este recurso.'
    );
    err.status = 503;
    throw err;
  }
}

export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  requireEmailConfigured();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to, subject, html, text });
}
