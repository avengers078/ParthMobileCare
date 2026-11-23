import * as https from 'https';

export interface SendEmailOptions {
  to: string;
  name: string;
  inviteLink: string;
  isResend?: boolean;
}

export interface SendEmailResult {
  delivered: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

/**
 * Generates an accessible, responsive HTML email template for password setup.
 */
function generateEmailHtml(name: string, inviteLink: string, isResend = false): string {
  const brandColor = '#194D9C';
  const actionText = isResend ? 'Reset Your Password' : 'Set Up Your Password';
  const headerSubtitle = isResend
    ? 'A request was made by the Store Administrator to reset your password.'
    : 'Welcome to the team! Your staff account has been provisioned.';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${actionText} — Parth Mobile Care</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .header { background-color: ${brandColor}; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .cta-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: ${brandColor}; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.3px; }
    .btn:hover { background-color: #123872; }
    .notice { font-size: 13px; color: #64748b; background-color: #f1f5f9; padding: 14px 16px; border-radius: 8px; margin-top: 24px; }
    .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Parth Mobile Care</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Store Management Portal</p>
    </div>
    <div class="content">
      <div class="greeting">Hello ${name || 'Staff Member'},</div>
      <p>${headerSubtitle}</p>
      <p>Click the secure button below to choose your password and activate your access to the store management system:</p>
      
      <div class="cta-container">
        <a href="${inviteLink}" class="btn" target="_blank" rel="noopener noreferrer">${actionText}</a>
      </div>

      <div class="notice">
        <strong>Security Notice:</strong> This link is valid for 1 hour. If you did not expect this invitation or if you have questions, please contact the Store Administrator immediately.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Parth Mobile Care. All rights reserved.<br>
      Automated account provisioning notification. Do not reply to this email.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends email via Resend REST API (zero native dependencies required).
 */
function sendViaResend(apiKey: string, to: string, name: string, inviteLink: string, isResend: boolean): Promise<SendEmailResult> {
  return new Promise((resolve) => {
    const fromAddress = process.env.EMAIL_FROM || 'Parth Mobile Care <onboarding@resend.dev>';
    const subject = isResend
      ? 'Reset Your Password — Parth Mobile Care'
      : 'Set Up Your Staff Account Password — Parth Mobile Care';
    const html = generateEmailHtml(name, inviteLink, isResend);

    const postData = JSON.stringify({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });

    const req = https.request(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(responseBody);
              resolve({ delivered: true, provider: 'resend', messageId: parsed.id });
            } catch {
              resolve({ delivered: true, provider: 'resend' });
            }
          } else {
            resolve({ delivered: false, provider: 'resend', error: `Resend API returned status ${res.statusCode}: ${responseBody}` });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ delivered: false, provider: 'resend', error: `Network error connecting to Resend: ${err.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ delivered: false, provider: 'resend', error: 'Request to Resend API timed out.' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Sends email via SendGrid REST API (zero native dependencies required).
 */
function sendViaSendgrid(apiKey: string, to: string, name: string, inviteLink: string, isResend: boolean): Promise<SendEmailResult> {
  return new Promise((resolve) => {
    const fromAddress = process.env.EMAIL_FROM || 'noreply@parthmobilecare.com';
    const subject = isResend
      ? 'Reset Your Password — Parth Mobile Care'
      : 'Set Up Your Staff Account Password — Parth Mobile Care';
    const html = generateEmailHtml(name, inviteLink, isResend);

    const postData = JSON.stringify({
      personalizations: [{ to: [{ email: to, name: name || undefined }] }],
      from: { email: fromAddress, name: 'Parth Mobile Care' },
      subject,
      content: [{ type: 'text/html', value: html }],
    });

    const req = https.request(
      'https://api.sendgrid.com/v3/mail/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 10000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ delivered: true, provider: 'sendgrid' });
        } else {
          let responseBody = '';
          res.on('data', (chunk) => { responseBody += chunk; });
          res.on('end', () => {
            resolve({ delivered: false, provider: 'sendgrid', error: `SendGrid returned status ${res.statusCode}: ${responseBody}` });
          });
        }
      }
    );

    req.on('error', (err) => {
      resolve({ delivered: false, provider: 'sendgrid', error: `Network error connecting to SendGrid: ${err.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ delivered: false, provider: 'sendgrid', error: 'Request to SendGrid API timed out.' });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Dispatches a password setup / reset email using available delivery providers.
 * If no provider is configured, returns delivered: false with a clear explanation
 * without throwing or blocking account creation.
 */
export async function sendPasswordSetupEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { to, name, inviteLink, isResend = false } = options;

  if (!inviteLink) {
    return { delivered: false, error: 'No invitation link provided.' };
  }

  // 1. Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.trim()) {
    return sendViaResend(resendApiKey.trim(), to, name, inviteLink, isResend);
  }

  // 2. SendGrid API
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey && sendgridApiKey.trim()) {
    return sendViaSendgrid(sendgridApiKey.trim(), to, name, inviteLink, isResend);
  }

  // 3. Neither provider configured
  return {
    delivered: false,
    error: 'No email delivery provider credentials configured (RESEND_API_KEY or SENDGRID_API_KEY not found in Firebase Functions environment).',
  };
}

