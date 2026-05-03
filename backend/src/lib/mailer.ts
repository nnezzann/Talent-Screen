import nodemailer from "nodemailer";
import env from "../config/env.js";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const MAIL_SEND_TIMEOUT_MS = 8_000;

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

function resolveSmtpConfig() {
  const host = trimText(env.SMTP_HOST) || "smtp.gmail.com";
  const portValue = Number(trimText(env.SMTP_PORT));
  const port = Number.isFinite(portValue) && portValue > 0 ? portValue : 587;
  const secure =
    trimText(env.SMTP_SECURE).toLowerCase() === "true" || port === 465;
  const user = trimText(env.SMTP_USER) || trimText(env.USER_EMAIL);
  const pass = trimText(env.SMTP_PASS) || trimText(env.USER_PASS);
  const from = trimText(env.SMTP_FROM) || (user ? `"Talvo" <${user}>` : "");

  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
  };
}

export function emailDeliveryConfigured() {
  if (trimText(env.BREVO_API_KEY)) {
    return true;
  }
  const smtp = resolveSmtpConfig();
  return Boolean(smtp.user && smtp.pass);
}

export async function sendMailIfConfigured(payload: MailPayload) {
  if (!emailDeliveryConfigured()) {
    return false;
  }

  const brevoApiKey = trimText(env.BREVO_API_KEY);
  
  if (brevoApiKey) {
    try {
      const smtp = resolveSmtpConfig();
      const fromEmail = smtp.from || "noreply@talvo.com";
      const fromName = "Talvo";
      
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: fromName,
            email: fromEmail.replace(/.*<(.+)>.*/, "$1").trim() // extract just the email if formatted like "Name <email>"
          },
          to: [
            {
              email: payload.to
            }
          ],
          subject: payload.subject,
          textContent: payload.text,
          ...(payload.html ? { htmlContent: payload.html } : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Brevo API error: ${response.status} ${errorText}`);
      }

      return true;
    } catch (error) {
      console.error("Brevo API delivery skipped:", error);
      return false;
    }
  }

  try {
    const smtp = resolveSmtpConfig();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      connectionTimeout: MAIL_SEND_TIMEOUT_MS,
      greetingTimeout: MAIL_SEND_TIMEOUT_MS,
      socketTimeout: MAIL_SEND_TIMEOUT_MS,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    await Promise.race([
      transporter.sendMail({
        from: smtp.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        ...(payload.html ? { html: payload.html } : {}),
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("Email send timeout exceeded"));
        }, MAIL_SEND_TIMEOUT_MS);
      }),
    ]);

    return true;
  } catch (error) {
    console.error("Email delivery skipped:", error);
    return false;
  }
}
