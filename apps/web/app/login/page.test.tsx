import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

vi.stubGlobal("React", React);

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];

  const element = node as TestElement;
  return [element, ...elements(element.props.children)];
}

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("LoginPage", () => {
  it("renders English Google and magic-link sign-in and always allows resend", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const { default: LoginPage } = await import("./page");
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    const copy = text(page);

    expect(copy).toContain("Sign in to Nodework");
    expect(copy).toContain("Send a magic link");
    expect(copy).toContain(
      "You can send another magic link from this page if the email does not arrive.",
    );
    expect(copy).toContain("Continue with Google");
    expect(copy).not.toContain("talent pool");
    expect(copy).not.toContain("Clerk");
    expect(copy).not.toContain("Resend");

    const emailInput = elements(page).find(
      (element) => element.type === "input" && element.props.name === "email",
    );
    const submit = elements(page).find(
      (element) => element.type === "button"
        && element.props.type === "submit"
        && text(element).includes("Send magic link"),
    );

    expect(emailInput?.props).toMatchObject({ type: "email", required: true });
    expect(submit).toBeDefined();
  });

  it("threads a safe next param into the magic-link and Google callback URLs", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const { default: LoginPage } = await import("./page");
    const { GoogleSignInButton, LoginForm } = await import("./login-form");
    const page = await LoginPage({
      searchParams: Promise.resolve({ next: "/dashboard" }),
    });

    const loginForm = elements(page).find((element) => element.type === LoginForm);
    const googleButton = elements(page).find(
      (element) => element.type === GoogleSignInButton,
    );

    expect(loginForm?.props).toMatchObject({
      callbackURL: "/dashboard",
      newUserCallbackURL: "/onboarding?next=%2Fdashboard",
    });
    expect(googleButton?.props).toMatchObject({
      callbackURL: "/dashboard",
      newUserCallbackURL: "/onboarding?next=%2Fdashboard",
    });
  });

  it("falls back to the homepage for an unsafe or absent next param", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const { default: LoginPage } = await import("./page");
    const { LoginForm } = await import("./login-form");
    const page = await LoginPage({
      searchParams: Promise.resolve({ next: "https://evil.example.com" }),
    });

    const loginForm = elements(page).find((element) => element.type === LoginForm);

    expect(loginForm?.props).toMatchObject({
      callbackURL: "/",
      newUserCallbackURL: "/onboarding",
    });
  });

  it("surfaces the account perks framing when arriving via the Get started CTA", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    const { default: LoginPage } = await import("./page");
    const page = await LoginPage({
      searchParams: Promise.resolve({ intent: "start" }),
    });
    const copy = text(page);

    expect(copy).toContain("Get started");
    expect(copy).toContain("Create your account in one step");
    expect(copy).toContain("A profile and PDF CV you fill in once");
  });
});
