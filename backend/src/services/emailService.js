/**
 * Bystander Email Service
 * Powered by Resend (https://resend.com) using native fetch (Node.js 18+).
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Sends a 6-digit OTP verification email via Resend.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.otp - 6-digit numeric OTP code
 * @param {string} [params.mode='verification'] - 'login' | 'signup' | 'verification'
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export const sendOtpEmail = async ({ to, otp, mode = 'verification' }) => {
  const apiKey = process.env.RESEND_API_KEY;
  let from = process.env.EMAIL_FROM || 'Bystander <onboarding@resend.dev>';
  if (typeof from === 'string') {
    from = from.replace(/^['"]|['"]$/g, '').trim();
  }

  if (!apiKey) {
    console.warn('[Email Service] RESEND_API_KEY not configured. Skipping email dispatch.');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const actionText = mode === 'signup' ? 'complete your registration' : 'sign in to your account';
  const subject = `Your Bystander Verification Code: ${otp}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #172b3a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f7fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #17a396 100%); padding: 32px 32px 28px 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Bystander</h1>
              <p style="margin: 4px 0 0 0; color: #ddf5ef; font-size: 13px; font-weight: 500;">Never Alone Healthcare Marketplace</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #172b3a;">One-Time Verification Code</h2>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Use the verification code below to ${actionText}. This code is valid for <strong>10 minutes</strong>.
              </p>

              <!-- OTP Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="background-color: #f0fdfa; border: 2px dashed #0f766e; border-radius: 12px; padding: 20px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #0f766e; display: inline-block;">
                      ${otp}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. Bystander staff will never ask for your verification code.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © ${new Date().getFullYear()} Bystander Technologies Inc. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Email Service Error] Failed to send email via Resend:', data);
      return {
        success: false,
        error: data.message || 'Failed to dispatch email via Resend',
      };
    }

    console.log(`[Email Service] Verification OTP email successfully sent to ${to} (Message ID: ${data.id})`);
    return {
      success: true,
      id: data.id,
    };
  } catch (err) {
    console.error('[Email Service Exception] Error sending email via Resend:', err);
    return {
      success: false,
      error: err.message,
    };
  }
};
