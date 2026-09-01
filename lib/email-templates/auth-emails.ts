export type VerificationEmailData = {
  displayName: string;
  email: string;
  verifyUrl: string;
};

export type PasswordResetEmailData = {
  displayName: string;
  email: string;
  resetUrl: string;
};

export function buildVerificationEmailHtml(data: VerificationEmailData): string {
  const { displayName, verifyUrl } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email — EcoLudus</title>
</head>
<body style="margin:0;padding:0;background:#f0f4e8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4e8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#102016;border-radius:20px 20px 0 0;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#8fbf7a;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;">EcoLudus</p>
              <h1 style="margin:8px 0 4px;color:#ffffff;font-size:26px;font-weight:700;">Verify your email</h1>
              <p style="margin:0;color:#8fbf7a;font-size:13px;">Confirm your address to activate your account.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a5c3a;">
                Hi ${displayName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a5c3a;">
                Confirm your email address to activate your EcoLudus account and start your eco journey.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#f7f9f2;padding:24px 32px;text-align:center;border-top:1px solid #e7ecdf;">
              <a href="${verifyUrl}"
                 style="display:inline-block;background:#102016;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:13px;font-weight:700;letter-spacing:0.06em;">
                Verify my email →
              </a>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6a8a6a;">
                This link expires in 24 hours. If you didn't create an EcoLudus account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f4e8;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#6a8a6a;">EcoLudus · This is an automated security email.</p>
              <p style="margin:6px 0 0;font-size:11px;color:#6a8a6a;">
                <a href="https://ecoludus.com" style="color:#3a7a3a;">EcoLudus</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildVerificationEmailText(data: VerificationEmailData): string {
  return `EcoLudus — Verify your email

Hi ${data.displayName},

Confirm your email address to activate your EcoLudus account and start your eco journey.

Verify your email by visiting this link (expires in 24 hours):

${data.verifyUrl}

If you didn't create an EcoLudus account, you can safely ignore this email.

EcoLudus · This is an automated security email.
https://ecoludus.com
`;
}

export function buildPasswordResetEmailHtml(data: PasswordResetEmailData): string {
  const { displayName, resetUrl } = data;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password — EcoLudus</title>
</head>
<body style="margin:0;padding:0;background:#f0f4e8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4e8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#102016;border-radius:20px 20px 0 0;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#8fbf7a;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;">EcoLudus</p>
              <h1 style="margin:8px 0 4px;color:#ffffff;font-size:26px;font-weight:700;">Reset your password</h1>
              <p style="margin:0;color:#8fbf7a;font-size:13px;">We received a request to reset your password.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a5c3a;">
                Hi ${displayName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3a5c3a;">
                We received a request to reset the password for your EcoLudus account.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background:#f7f9f2;padding:24px 32px;text-align:center;border-top:1px solid #e7ecdf;">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#102016;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:13px;font-weight:700;letter-spacing:0.06em;">
                Reset password →
              </a>
              <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6a8a6a;">
                This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password will not change.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f4e8;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#6a8a6a;">EcoLudus · This is an automated security email.</p>
              <p style="margin:6px 0 0;font-size:11px;color:#6a8a6a;">
                <a href="https://ecoludus.com" style="color:#3a7a3a;">EcoLudus</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildPasswordResetEmailText(data: PasswordResetEmailData): string {
  return `EcoLudus — Reset your password

Hi ${data.displayName},

We received a request to reset the password for your EcoLudus account.

Reset your password by visiting this link (expires in 1 hour):

${data.resetUrl}

If you didn't request a password reset, you can safely ignore this email — your password will not change.

EcoLudus · This is an automated security email.
https://ecoludus.com
`;
}