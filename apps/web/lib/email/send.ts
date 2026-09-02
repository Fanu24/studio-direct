export async function sendEmail({
  email,
  to,
  from,
  subject,
  text,
  html,
  log = console,
}: {
  email: {
    send: (message: {
      to: string;
      from: string;
      subject: string;
      text?: string;
      html?: string;
    }) => Promise<unknown>;
  };
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  log?: Pick<Console, "error">;
}): Promise<void> {
  try {
    await email.send({ to, from, subject, text, html });
  } catch (error) {
    log.error("Email send failed", { email: to, error });
    throw error;
  }
}
