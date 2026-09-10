import { TENANT_NAME } from "@gaming/shared";

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
      subject: `Your ${TENANT_NAME} sign-in link`,
      text: `Sign in to ${TENANT_NAME}: ${url}`,
      html: `<p><a href="${url}">Sign in to ${TENANT_NAME}</a></p>`,
    });
  } catch (error) {
    log.error("Magic link email send failed", { email: to, error });
    throw error;
  }
}
