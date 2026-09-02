export async function sendMagicLinkEmail({
  email,
  to,
  url,
  from,
  log = console,
}: {
  email: { send: (message: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<unknown> };
  to: string;
  url: string;
  from: string;
  log?: Pick<Console, "error">;
}): Promise<void> {
  try {
    await email.send({
      to,
      from,
      subject: "Your Studio Direct sign-in link",
      text: `Sign in to Studio Direct: ${url}`,
      html: `<p><a href="${url}">Sign in to Studio Direct</a></p>`,
    });
  } catch (error) {
    log.error("Magic link email send failed", { email: to, error });
    throw error;
  }
}
