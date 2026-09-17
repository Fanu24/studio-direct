import { TENANT_SLUG } from "@gaming/shared";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { sendMagicLinkEmail } from "./email";

export const GAMING_TENANT_SLUG = TENANT_SLUG;

const snakeCaseFields = {
  emailVerified: "email_verified",
  createdAt: "created_at",
  updatedAt: "updated_at",
  userId: "user_id",
  expiresAt: "expires_at",
  ipAddress: "ip_address",
  userAgent: "user_agent",
  accountId: "account_id",
  providerId: "provider_id",
  accessToken: "access_token",
  refreshToken: "refresh_token",
  idToken: "id_token",
  accessTokenExpiresAt: "access_token_expires_at",
  refreshTokenExpiresAt: "refresh_token_expires_at",
} as const;

export type AuthEnv = {
  DB: {
    prepare: (sql: string) => {
      bind: (...values: unknown[]) => {
        first: <T = unknown>(column?: string) => Promise<T | null>;
      };
    };
  };
  EMAIL: {
    send: (message: {
      to: string;
      from: string;
      subject: string;
      text?: string;
      html?: string;
    }) => Promise<unknown>;
  };
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  EMAIL_FROM: string;
  EMAIL_ENABLED?: string;
  LOCAL_MAIL?: string;
  BETTER_AUTH_URL?: string;
  SITE_URL?: string;
};

function authBaseURL(env: AuthEnv): string | undefined {
  const url = env.BETTER_AUTH_URL || env.SITE_URL || process.env.BETTER_AUTH_URL || process.env.SITE_URL;
  return url?.trim() || undefined;
}

export function createAuth(env: AuthEnv) {
  const baseURL = authBaseURL(env);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: baseURL ? [baseURL] : undefined,
    database: env.DB,
    user: {
      modelName: "users",
      fields: {
        emailVerified: snakeCaseFields.emailVerified,
        createdAt: snakeCaseFields.createdAt,
        updatedAt: snakeCaseFields.updatedAt,
      },
      additionalFields: {
        tenantId: {
          type: "string",
          required: true,
          input: false,
          fieldName: "tenant_id",
        },
      },
    },
    session: {
      fields: {
        userId: snakeCaseFields.userId,
        expiresAt: snakeCaseFields.expiresAt,
        ipAddress: snakeCaseFields.ipAddress,
        userAgent: snakeCaseFields.userAgent,
        createdAt: snakeCaseFields.createdAt,
        updatedAt: snakeCaseFields.updatedAt,
      },
    },
    account: {
      fields: {
        accountId: snakeCaseFields.accountId,
        providerId: snakeCaseFields.providerId,
        userId: snakeCaseFields.userId,
        accessToken: snakeCaseFields.accessToken,
        refreshToken: snakeCaseFields.refreshToken,
        idToken: snakeCaseFields.idToken,
        accessTokenExpiresAt: snakeCaseFields.accessTokenExpiresAt,
        refreshTokenExpiresAt: snakeCaseFields.refreshTokenExpiresAt,
        createdAt: snakeCaseFields.createdAt,
        updatedAt: snakeCaseFields.updatedAt,
      },
    },
    verification: {
      fields: {
        expiresAt: snakeCaseFields.expiresAt,
        createdAt: snakeCaseFields.createdAt,
        updatedAt: snakeCaseFields.updatedAt,
      },
    },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {google: {clientId: env.GOOGLE_CLIENT_ID,clientSecret: env.GOOGLE_CLIENT_SECRET}} : {},
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const tenantId = await env.DB
              .prepare("SELECT id FROM tenants WHERE slug = ?")
              .bind(GAMING_TENANT_SLUG)
              .first<string>("id");

            if (!tenantId) {
              throw new Error("Nodework tenant was not found");
            }

            return {
              data: {
                ...user,
                tenantId,
              },
            };
          },
        },
      },
    },
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // Explicitly local only. Production never logs login tokens.
          if (env.LOCAL_MAIL === 'true' && process.env.NODE_ENV === 'development'
            && baseURL && ['localhost','127.0.0.1'].includes(new URL(baseURL).hostname)) {
            console.info(`[LOCAL EMAIL] ${email}: ${url}`);
            return;
          }
          if (env.EMAIL_ENABLED !== 'true') throw new Error('Email delivery is not configured');
          await sendMagicLinkEmail({
            email: env.EMAIL,
            to: email,
            url,
            from: env.EMAIL_FROM,
          });
        },
      }),
      nextCookies(),
    ],
  });
}
