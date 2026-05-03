import env from "../config/env.js";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function trimText(value: unknown) {
  return String(value ?? "").trim();
}

export function emailDeliveryConfigured() {
  return Boolean(trimText(env.BREVO_API_KEY));
}

export async function sendMailIfConfigured(payload: MailPayload) {
  const brevoApiKey = trimText(env.BREVO_API_KEY);

  if (!brevoApiKey) {
    return false;
  }

  try {
    const fromEmail = env.FROM_EMAIL;
    const fromName = env.FROM_NAME;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: fromName,
          email: fromEmail,
        },
        to: [
          {
            email: payload.to,
          },
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
