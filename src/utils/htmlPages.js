import { getEnv } from "../configs/config.js";

const returnMailPage = (link) => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset Your Password</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f4f4f9;
        font-family: Arial, sans-serif;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      .container {
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .header {
        background-color: #6c63ff;
        color: #ffffff;
        text-align: center;
        padding: 20px;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
      }
      .content {
        padding: 20px;
        text-align: center;
      }
      .content p {
        font-size: 16px;
        color: #333333;
        line-height: 1.6;
      }
      .button {
        display: inline-block;
        margin: 20px 0;
        padding: 12px 25px;
        font-size: 16px;
        background-color: #6c63ff;
        color: #ffffff ! important;
        text-decoration: none;
        border-radius: 5px;
        cursor: pointer;
      }
      .button:hover {
        background-color: #5548c8;
      }
      .footer {
        background-color: #f4f4f9;
        text-align: center;
        padding: 15px;
        font-size: 12px;
        color: #777777;
      }
      @media screen and (max-width: 600px) {
        .container {
          width: 90%;
          margin: 10px auto;
        }
        .content p {
          font-size: 14px;
        }
        .button {
          font-size: 14px;
          padding: 10px 20px;
        }
        .header h1 {
          font-size: 20px;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" class="container">
      <tr>
        <td class="header">
          <h1>Reset Your Password</h1>
        </td>
      </tr>
      <tr>
        <td class="content">
          <p>Click the button below to reset your password.</p>
          <a href="${link}" class="button">Reset Password</a>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p>If you did not request a password reset, please ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

const mailTemplateForNotifications = (data) => {
  const { clientName, message, clientCompany, senderCompany } = data;
  return `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Email Notification</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#f5f6fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 3px 10px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:20px; background:#ffffff; border-bottom:2px solid #e6e6e6;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Logo -->
                  <td align="left" style="width:25%;">
                    <img src=${getEnv("LOGO_URL_WITH_BACKGROUND")} 
                         alt="National Warranty System" 
                         style="max-height:50px; width:auto; border-radius:50%;" />
                  </td>
                  <!-- Company Name -->
                  <td align="center" style="width:75%; color:#043655; font-size:22px; font-weight:bold; letter-spacing:0.5px;">
                    National Warranty System
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting + Message -->
          <tr>
            <td style="padding:30px; font-size:16px; color:#333;">
              <p style="margin:0; font-size:16px; color:#222;">
                Dear <strong>${clientName}</strong> from <strong>${clientCompany}</strong>,
              </p>
              <p style="margin-top:15px; line-height:1.6; color:#555;">
                ${message}
              </p>
              <p style="margin-top:20px; font-size:14px; color:#444;">
                If you have any questions, feel free to reply to this email.  
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; background:#f9f9f9; text-align:center; font-size:12px; color:#777; border-top:1px solid #e6e6e6;">
              <p style="margin:0; color:#555;">Best regards,</p>
              <p style="margin:5px 0; font-weight:bold; color:#043655;">National Warranty System</p>
              <p style="margin-top:10px; font-size:11px; color:#999;">
                © ${new Date().getFullYear()} National Warranty System. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>

`;
};

// for new user through membership or donation

const mailTemplateForNewUserCredentials = (data) => {
  const {
    message,
    receiverEmail,
    autoPassword,
    senderCompany,
    loginUrl,
    logoUrl,
  } = data;

  return `
  <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Account Credentials</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background:#f5f6fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 3px 10px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:20px; background:#ffffff; border-bottom:2px solid #e6e6e6;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="width:25%;">
                    <img src="${logoUrl}" 
                         alt="${senderCompany}" 
                         style="max-height:50px; width:auto; border-radius:50%;" />
                  </td>
                  <td align="center" style="width:75%; color:#043655; font-size:22px; font-weight:bold; letter-spacing:0.5px;">
                    ${senderCompany}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:30px; text-align:center; color:#333;">
              <h2 style="color:#043655; margin:0 0 15px;">Welcome to ${senderCompany}!</h2>
              <p style="margin:0; font-size:16px; color:#444; line-height:1.6;">
                ${
                  message ||
                  "Hi there, your account has been created automatically when you made a payment using your email"
                } <strong>${receiverEmail}</strong>.
              </p>

              <p style="margin-top:25px; font-size:15px; color:#333;">
                Here are your login details:
              </p>

              <table align="center" cellpadding="10" cellspacing="0" style="margin:15px auto; background:#f8f9fa; border-radius:6px; border:1px solid #e6e6e6;">
                <tr>
                  <td align="right" style="font-weight:bold; color:#043655;">Email:</td>
                  <td align="left">${receiverEmail}</td>
                </tr>
                <tr>
                  <td align="right" style="font-weight:bold; color:#043655;">Password:</td>
                  <td align="left" style="font-family:'Courier New', monospace; letter-spacing:1px;">${autoPassword}</td>
                </tr>
              </table>

              <p style="margin-top:15px; font-size:14px; color:#555;">
                You can log in now and change your password anytime from your account settings.
              </p>

              <a href="${loginUrl}" 
                 style="display:inline-block; margin-top:25px; padding:12px 30px; background:#043655; color:#fff; text-decoration:none; border-radius:6px; font-weight:bold; letter-spacing:0.5px;">
                 Go to Login Page
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; background:#f9f9f9; text-align:center; font-size:12px; color:#777; border-top:1px solid #e6e6e6;">
              <p style="margin:0; color:#555;">Best regards,</p>
              <p style="margin:5px 0; font-weight:bold; color:#043655;">${senderCompany}</p>
              <p style="margin-top:10px; font-size:11px; color:#999;">
                © ${new Date().getFullYear()} ${senderCompany}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const receiptMailTemplate = (data) => {
  const { name, email, amount, currency, status, transactionId, date } = data;

  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Successful - Global Learning Bridge</title>
  </head>
  <body
    style="
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f7f8fa;
      margin: 0;
      padding: 0;
    "
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;"
    >
      <!-- Header -->
      <tr style="background-color: #ffffff; color: #000;">
        <td style="text-align: center; padding: 25px;">
          <img
            src=${getEnv("LOGO_URL_WITH_BACKGROUND")}
            alt="Global Learning Bridge Logo"
            width="120"
            style="margin-bottom: 10px;"
          />
          <h2 style="margin: 0; font-size: 22px; color: #28a745;">
            Payment Successful
          </h2>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">
            Dear <strong>${name || "Donor"}</strong>,
          </p>
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            We are pleased to inform you that your recent payment to
            <strong>Global Learning Bridge</strong> has been successfully processed.
            Thank you for your generosity and continued support for our mission
            to make education accessible to all.
          </p>

          <table
            width="100%"
            cellpadding="8"
            cellspacing="0"
            style="border: 1px solid #e5e5e5; border-radius: 6px; margin: 20px 0;"
          >
            <tr style="background-color: #f9fafb;">
              <td><strong>Donor Name:</strong></td>
              <td>${name || "Donor"}</td>
            </tr>
            <tr>
              <td><strong>Email:</strong></td>
              <td>${email}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td><strong>Amount:</strong></td>
              <td>${amount} ${currency}</td>
            </tr>
            <tr>
              <td><strong>Status:</strong></td>
              <td style="color: #28a745; font-weight: bold;">${status}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td><strong>Transaction ID:</strong></td>
              <td>${transactionId}</td>
            </tr>
            <tr>
              <td><strong>Date:</strong></td>
              <td>${formattedDate}</td>
            </tr>
          </table>

          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Your payment confirmation has been recorded successfully. A copy of
            this receipt is attached for your records. If you have any
            questions, please reach out to our support team.
          </p>

          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Thank you once again for your support — together we’re building a
            brighter educational future.
          </p>

          <p style="font-size: 15px; color: #333;">
            Warm regards,<br />
            <strong>Global Learning Bridge Team</strong><br />
            <a
              href="https://www.globallearningbridge.org"
              style="color: #004aad; text-decoration: none;"
              >www.globallearningbridge.org</a
            >
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td
          style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #777;"
        >
          © {{year}} Global Learning Bridge. All rights reserved.<br />
          EIN: 12-3456789
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

const failedPaymentTemplate = (data) => {
  const { name, email, amount, currency, status, transactionId, date } = data;

  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Failed - Global Learning Bridge</title>
  </head>
  <body
    style="
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f7f8fa;
      margin: 0;
      padding: 0;
    "
  >
    <table
      width="100%"
      cellpadding="0"
      cellspacing="0"
      style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;"
    >
      <!-- Header -->
      <tr style="background-color: #ffffff; color: #000;">
        <td style="text-align: center; padding: 25px;">
          <img
            src=${getEnv("LOGO_URL_WITH_BACKGROUND")}
            alt="Global Learning Bridge Logo"
            width="120"
            style="margin-bottom: 10px;"
          />
          <h2 style="margin: 0; font-size: 22px; color: #d93025;">
            Payment Failed
          </h2>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">
            Dear <strong>${name || "Donor"}</strong>,
          </p>
          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            Unfortunately, your recent payment to
            <strong>Global Learning Bridge</strong> could not be processed.
            Please review the details below and try again. If the issue persists,
            contact our support team for assistance.
          </p>

          <table
            width="100%"
            cellpadding="8"
            cellspacing="0"
            style="border: 1px solid #e5e5e5; border-radius: 6px; margin: 20px 0;"
          >
            <tr style="background-color: #f9fafb;">
              <td><strong>Donor Name:</strong></td>
              <td>${name || "Donor"}</td>
            </tr>
            <tr>
              <td><strong>Email:</strong></td>
              <td>${email}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td><strong>Amount:</strong></td>
              <td>${amount} ${currency}</td>
            </tr>
            <tr>
              <td><strong>Status:</strong></td>
              <td style="color: #d93025; font-weight: bold;">${status}</td>
            </tr>
            <tr style="background-color: #f9fafb;">
              <td><strong>Transaction ID:</strong></td>
              <td>${transactionId}</td>
            </tr>
            <tr>
              <td><strong>Date:</strong></td>
              <td>${formattedDate}</td>
            </tr>
          </table>

          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Please ensure your payment details are correct and that your account
            has sufficient funds. You may also try using a different payment method.
          </p>

          <p style="font-size: 15px; color: #555; line-height: 1.6;">
            For further assistance, feel free to contact us at
            <a href="mailto:support@globallearningbridge.org" style="color: #004aad;">support@globallearningbridge.org</a>.
          </p>

          <p style="font-size: 15px; color: #333;">
            Warm regards,<br />
            <strong>Global Learning Bridge Team</strong><br />
            <a
              href="https://www.globallearningbridge.org"
              style="color: #004aad; text-decoration: none;"
              >www.globallearningbridge.org</a
            >
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td
          style="background-color: #f1f1f1; text-align: center; padding: 15px; font-size: 12px; color: #777;"
        >
          © {{year}} Global Learning Bridge. All rights reserved.<br />
          EIN: 12-3456789
        </td>
      </tr>
    </table>
  </body>
</html>
`;
};

export {
  mailTemplateForNotifications,
  returnMailPage,
  mailTemplateForNewUserCredentials,
  receiptMailTemplate,
  failedPaymentTemplate,
};
