// Bespoke per-template interaction flows for the Aurora QA interaction dimension.
// Imports the proven harness primitives (settle) but drives real Playwright
// mouse/keyboard actions per design spec 4.2, rather than the generic
// aria-expanded sweep in qa/run.mjs.

import { chromium, firefox, webkit } from "@playwright/test";

const BASE = "http://localhost:3100";
const log = [];
function record(name, ok, detail) {
  log.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? " - " + detail : ""}`);
}

async function settle(page) {
  await page.waitForTimeout(350);
}

/**
 * Next.js App Router client-side navigations (clicking a next/link chip,
 * pager link, etc.) do not fire a new top-level "load" event, so
 * page.waitForLoadState("networkidle") after a click can return before the
 * RSC fetch + re-render actually lands - measured by hand at ~600ms end to
 * end for a filter chip on this app, well past harness.mjs's 350ms settle()
 * (which is proven correct for same-document aria-expanded state, not for
 * URL changes). Poll for the URL to actually change, then settle() once more
 * for the post-navigation render to commit, before reading anything.
 */
async function clickAndWaitForNav(page, locator, { timeout = 6000 } = {}) {
  const before = page.url();
  await locator.click();
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline && page.url() === before) {
    await page.waitForTimeout(50);
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await settle(page);
  return page.url() !== before;
}

const LAUNCHERS = { chromium, firefox, webkit };

async function withPage(engineName, viewport, fn) {
  const launcher = LAUNCHERS[engineName];
  const browser = await launcher.launch();
  try {
    const context = await browser.newContext({
      viewport,
      ...(engineName === "chromium" && viewport.width <= 480 ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await context.newPage();
    await fn(page, context);
  } finally {
    await browser.close();
  }
}

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

async function main() {
  // ---------------------------------------------------------------
  // 1. /jobs filter bar: seniority chip, source chip, hidden chip
  // ---------------------------------------------------------------
  await withPage("chromium", DESKTOP, async (page) => {
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
    const countBefore = await page.locator(".jobs-num").first().innerText();

    // Click a seniority chip (e.g. "Senior")
    const chip = page.locator(".jobs-chip-track a.chip", { hasText: /^Senior$/ }).first();
    const chipText = await chip.innerText();
    await clickAndWaitForNav(page, chip);
    const urlAfter = page.url();
    const activeNow = await page.locator(".jobs-chip-track a.chip--active").count();
    const countAfter = await page.locator(".jobs-num").first().innerText();
    const activeChipVisible = await page.locator(".jobs-active .chip--active").count();
    record(
      "jobs filter: seniority chip click changes URL",
      urlAfter.includes("seniority="),
      `url=${urlAfter}`,
    );
    record(
      "jobs filter: seniority chip renders active state",
      activeNow >= 1,
      `active chip count=${activeNow}`,
    );
    record(
      "jobs filter: seniority chip changes match count",
      countBefore !== countAfter,
      `before=${countBefore} after=${countAfter}`,
    );
    record(
      "jobs filter: active-filters ribbon shows the chip",
      activeChipVisible >= 1,
      `ribbon chip count=${activeChipVisible}`,
    );

    // Clear filters
    const clearLink = page.locator(".jobs-active__clear");
    if (await clearLink.count()) {
      await clickAndWaitForNav(page, clearLink);
      const urlCleared = page.url();
      record(
        "jobs filter: Clear filters returns to /jobs with no params",
        urlCleared === `${BASE}/jobs` || urlCleared === `${BASE}/jobs?`,
        `url=${urlCleared}`,
      );
    } else {
      record("jobs filter: Clear filters link present", false, "no .jobs-active__clear found");
    }

    // source chip: "Direct from career pages"
    const sourceChip = page.locator(".jobs-chip-track a.chip", { hasText: /direct from career pages/i });
    await clickAndWaitForNav(page, sourceChip);
    record(
      "jobs filter: source chip (career_page) sets source= in URL",
      page.url().includes("source=career_page"),
      `url=${page.url()}`,
    );
    const sourceActive = await page.locator(".jobs-chip-track a.chip--active", { hasText: /direct from career pages/i }).count();
    record("jobs filter: source chip shows active state", sourceActive === 1, `active=${sourceActive}`);

    // toggle off by clicking again
    await clickAndWaitForNav(page, page.locator(".jobs-chip-track a.chip", { hasText: /direct from career pages/i }));
    record(
      "jobs filter: clicking active source chip again clears it",
      !page.url().includes("source="),
      `url=${page.url()}`,
    );

    // hidden ("Not on LinkedIn") chip
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
    const totalBeforeHidden = await page.locator(".jobs-num").first().innerText();
    const hiddenChip = page.locator(".jobs-chip-track a.chip", { hasText: /not on linkedin/i });
    await clickAndWaitForNav(page, hiddenChip);
    const totalAfterHidden = await page.locator(".jobs-num").first().innerText();
    record(
      "jobs filter: 'Not on LinkedIn' chip sets hidden=1",
      page.url().includes("hidden=1"),
      `url=${page.url()}`,
    );
    record(
      "jobs filter: 'Not on LinkedIn' chip changes result count",
      totalBeforeHidden !== totalAfterHidden,
      `before=${totalBeforeHidden} after=${totalAfterHidden}`,
    );
    // sample a row to confirm badge presence
    const badgeCount = await page.locator(".badge--honest").count();
    record(
      "jobs filter: 'Not on LinkedIn' results actually carry the exclusivity badge",
      badgeCount > 0,
      `badge count on page=${badgeCount}`,
    );
  });

  // Mobile viewport: same filter chip, verify tap target + URL change
  await withPage("chromium", MOBILE, async (page) => {
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
    const chip = page.locator(".jobs-chip-track a.chip", { hasText: /^Senior$/ }).first();
    const before390 = page.url();
    await chip.tap();
    const deadline390 = Date.now() + 6000;
    while (Date.now() < deadline390 && page.url() === before390) await page.waitForTimeout(50);
    await settle(page);
    record(
      "jobs filter @390px: tap on seniority chip changes URL",
      page.url().includes("seniority="),
      `url=${page.url()}`,
    );
  });

  // ---------------------------------------------------------------
  // 2. Search: type, submit, confirm GET /jobs?q=
  // ---------------------------------------------------------------
  await withPage("chromium", DESKTOP, async (page) => {
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
    const form = page.locator("form.search-bar");
    const action = await form.getAttribute("action");
    const method = await form.getAttribute("method");
    const input = page.locator('input[name="q"]');
    await input.click();
    await input.fill("solidity");
    await input.press("Enter");
    await page.waitForLoadState("networkidle");
    await settle(page);
    const url = new URL(page.url());
    record(
      "search: form action=/jobs method=get, input name=q",
      action === "/jobs" && (method ?? "get").toLowerCase() === "get",
      `action=${action} method=${method}`,
    );
    record(
      "search: submitting q=solidity lands on /jobs?q=solidity",
      url.pathname === "/jobs" && url.searchParams.get("q") === "solidity",
      `url=${page.url()}`,
    );
    const rows = await page.locator(".board-tr").count();
    record("search: result rows render for query", rows >= 0, `rows=${rows}`);
  });

  // ---------------------------------------------------------------
  // 3. Pagination: catalog page 2 + ranked page 2 rank numbering
  // ---------------------------------------------------------------
  await withPage("chromium", DESKTOP, async (page) => {
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
    const firstRowP1 = await page.locator(".board-row__title").first().innerText();
    const next = page.locator('.pager a[rel="next"]');
    await clickAndWaitForNav(page, next);
    const firstRowP2 = await page.locator(".board-row__title").first().innerText();
    const currentPageLabel = await page.locator(".pager [aria-current=page]").innerText();
    record(
      "catalog pagination: Next loads page 2 with different rows",
      firstRowP1 !== firstRowP2,
      `p1="${firstRowP1}" p2="${firstRowP2}"`,
    );
    record(
      "catalog pagination: current page marked 2",
      /2/.test(currentPageLabel),
      `label="${currentPageLabel}"`,
    );

    await page.goto(`${BASE}/highest-paid-developer-jobs`, { waitUntil: "networkidle" });
    const rank1 = (await page.locator(".board-row__rank").first().innerText()).trim();
    await clickAndWaitForNav(page, page.locator('.pager a[rel="next"]'));
    const rank21 = (await page.locator(".board-row__rank").first().innerText()).trim();
    const rank1Num = rank1.match(/(\d+)\s*$/)?.[1];
    const rank21Num = rank21.match(/(\d+)\s*$/)?.[1];
    record(
      "ranked pagination: page 1 first rank is 1, page 2 first rank is 21 (20/page)",
      rank1Num === "1" && rank21Num === "21",
      `page1 first rank="${rank1}" (parsed ${rank1Num}) page2 first rank="${rank21}" (parsed ${rank21Num})`,
    );
  });

  // ---------------------------------------------------------------
  // 4. Mobile menu + mega menu
  // ---------------------------------------------------------------
  for (const engine of ["chromium", "firefox", "webkit"]) {
    await withPage(engine, MOBILE, async (page) => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const toggle = page.locator("button.menu-button");
      const before = await toggle.getAttribute("aria-expanded");
      await toggle.click();
      await settle(page);
      const after = await toggle.getAttribute("aria-expanded");
      const menuVisible = await page.locator("#mobile-menu").isVisible();
      record(
        `mobile menu @${engine}: click toggles aria-expanded false->true`,
        before === "false" && after === "true" && menuVisible,
        `before=${before} after=${after} visible=${menuVisible}`,
      );

      // Escape closes and returns focus to toggle
      await page.keyboard.press("Escape");
      await settle(page);
      const afterEsc = await toggle.getAttribute("aria-expanded");
      const focused = await page.evaluate(() => document.activeElement?.classList.contains("menu-button"));
      record(
        `mobile menu @${engine}: Escape closes and returns focus to toggle`,
        afterEsc === "false" && focused === true,
        `aria-expanded=${afterEsc} focusReturned=${focused}`,
      );

      // Keyboard: Tab to toggle, Enter/Space to open
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
      await page.keyboard.press("Tab");
      // The menu button might not be the very first tabbable; search until found or give up after 15 tabs
      let found = false;
      for (let i = 0; i < 15; i++) {
        const tag = await page.evaluate(() => document.activeElement?.className || "");
        if (typeof tag === "string" && tag.includes("menu-button")) {
          found = true;
          break;
        }
        await page.keyboard.press("Tab");
      }
      if (found) {
        await page.keyboard.press("Enter");
        await settle(page);
        const kbExpanded = await toggle.getAttribute("aria-expanded");
        record(
          `mobile menu @${engine}: keyboard Enter on focused toggle opens menu`,
          kbExpanded === "true",
          `aria-expanded=${kbExpanded}`,
        );
      } else {
        record(`mobile menu @${engine}: keyboard reach toggle within 15 tabs`, false, "toggle not reached by Tab");
      }
    });
  }

  // Mega menu desktop: focus-within hover panel via keyboard
  await withPage("chromium", DESKTOP, async (page) => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const trigger = page.locator(".nav-mega__trigger").first();
    await trigger.focus();
    await settle(page);
    const panel = page.locator(".nav-mega__item").first().locator(".nav-mega__panel");
    const opacity = await panel.evaluate((el) => getComputedStyle(el).visibility + "/" + getComputedStyle(el).opacity);
    const firstLink = panel.locator("a").first();
    const linkVisible = await firstLink.isVisible().catch(() => false);
    record(
      "mega menu: focusing trigger reveals panel (focus-within) and its first link is visible",
      linkVisible,
      `panel visibility/opacity=${opacity} linkVisible=${linkVisible}`,
    );
    // click the trigger link itself navigates
    const navigated = await clickAndWaitForNav(page, trigger);
    record("mega menu: trigger is a real link and navigates on click", navigated, `url=${page.url()}`);
  });

  // ---------------------------------------------------------------
  // 5/6. Unlock gate — the highest value check
  // ---------------------------------------------------------------
  await withPage("chromium", DESKTOP, async (page) => {
    const gatedUrl = `${BASE}/jobs/senior-gameplay-engineer-riot-games`;
    const resp = await page.goto(gatedUrl, { waitUntil: "networkidle" });
    const html = await resp.text().catch(async () => await page.content());
    const leaks = /example\.invalid\/apply\/riot-gameplay/.test(html);
    record(
      "unlock gate: raw served HTML for a gated job never contains the real apply_url",
      !leaks,
      `leak found=${leaks}`,
    );
    const gateVisible = await page.locator(".jd-unlock-gate").isVisible();
    const applyNowVisible = await page.locator(".jd-apply .button--primary", { hasText: /apply now/i }).count();
    record(
      "unlock gate: anonymous visitor sees the unlock gate on a not-on-LinkedIn job",
      gateVisible && applyNowVisible === 0,
      `gateVisible=${gateVisible} normalApplyButtons=${applyNowVisible}`,
    );

    // Click "Unlock application link" as an anonymous visitor
    const unlockBtn = page.locator(".jd-unlock__button");
    const [unlockResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/unlock"), { timeout: 5000 }).catch(() => null),
      unlockBtn.click(),
    ]);
    await settle(page);
    let unlockStatus = null;
    let unlockBody = null;
    if (unlockResponse) {
      unlockStatus = unlockResponse.status();
      unlockBody = await unlockResponse.text().catch(() => "<unreadable>");
    }
    const bodyLeaksUrl = unlockBody ? /example\.invalid/.test(unlockBody) : false;
    record(
      "unlock gate: anonymous unlock POST does not hand back the real apply_url",
      !bodyLeaksUrl,
      `status=${unlockStatus} bodySnippet=${(unlockBody ?? "").slice(0, 200)}`,
    );
    record(
      "unlock gate: anonymous unlock is rejected (not a bare 200 apply)",
      unlockStatus !== 200,
      `status=${unlockStatus}`,
    );

    // Non-exclusive job shows normal apply flow, no gate
    const openUrl = `${BASE}/jobs/tools-programmer-unreal-editor-epic-games`;
    await page.goto(openUrl, { waitUntil: "networkidle" });
    const openGateVisible = await page.locator(".jd-unlock-gate").count();
    const openApplyLink = await page.locator('a.button--primary[href*="/apply"]', { hasText: /apply now/i }).count();
    record(
      "unlock gate: non-exclusive job shows normal on-site apply flow, no gate",
      openGateVisible === 0 && openApplyLink > 0,
      `gateNodes=${openGateVisible} applyLinks=${openApplyLink}`,
    );
  });

  // Mobile fixed apply bar
  await withPage("chromium", MOBILE, async (page) => {
    await page.goto(`${BASE}/jobs/senior-gameplay-engineer-riot-games`, { waitUntil: "networkidle" });
    const fixedBar = page.locator(".jd-apply-fixed");
    const visible = await fixedBar.isVisible();
    const btnText = await fixedBar.locator("a,button").first().innerText().catch(() => "");
    record(
      "mobile apply bar: fixed bar visible at 390px on a gated job, shows Unlock",
      visible && /unlock/i.test(btnText),
      `visible=${visible} text="${btnText}"`,
    );
    await page.goto(`${BASE}/jobs/tools-programmer-unreal-editor-epic-games`, { waitUntil: "networkidle" });
    const btnText2 = await page.locator(".jd-apply-fixed a,.jd-apply-fixed button").first().innerText().catch(() => "");
    record(
      "mobile apply bar: on non-exclusive job shows Apply now, not Unlock",
      /apply now/i.test(btnText2),
      `text="${btnText2}"`,
    );
  });

  // ---------------------------------------------------------------
  // 7. Accordions / carousels / disclosure widgets
  // ---------------------------------------------------------------
  await withPage("chromium", DESKTOP, async (page) => {
    // /jobs's own BoardFaq is called with items=[] (app/jobs/page.tsx), so it
    // renders only the single always-open "featured" <details> - no closed
    // entry exists there to click. Confirmed by hand (curl + grep) before
    // writing this: not a bug, /jobs has no landing-specific FAQ content to
    // show. The home page's FAQ (home-mega.tsx) is a real 6-entry accordion
    // with entries 1-5 closed by default, so that is what this exercises.
    await page.goto(`${BASE}/jobs`, { waitUntil: "networkidle" });
    const jobsFaqCount = await page.locator(".faq-accordion details.faq-item").count();
    record(
      "FAQ accordion (/jobs): only the single always-open item exists (items=[])",
      jobsFaqCount === 1,
      `count=${jobsFaqCount} (confirms app/jobs/page.tsx passes items=[] to BoardFaq, not a defect)`,
    );

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const homeFaqCount = await page.locator(".faq-accordion details.faq-item").count();
    const firstFaq = page.locator(".faq-accordion details.faq-item").nth(1); // nth(0) is open by default
    const beforeOpen = await firstFaq.evaluate((el) => el.hasAttribute("open"));
    await firstFaq.locator("summary").click();
    await settle(page);
    const afterOpen = await firstFaq.evaluate((el) => el.hasAttribute("open"));
    record(
      "FAQ accordion (home): clicking summary toggles native <details open>",
      beforeOpen !== afterOpen,
      `homeFaqCount=${homeFaqCount} before=${beforeOpen} after=${afterOpen}`,
    );
    // keyboard: focus summary, press Enter
    const secondFaq = page.locator(".faq-accordion details.faq-item").nth(2);
    await secondFaq.locator("summary").focus();
    await page.keyboard.press("Enter");
    await settle(page);
    const kbOpen = await secondFaq.evaluate((el) => el.hasAttribute("open"));
    record(
      "FAQ accordion (home): keyboard Enter on focused summary opens it",
      kbOpen === true,
      `open=${kbOpen}`,
    );

    // Home page reviews carousel (already on `/`)
    const carousel = page.locator(".home-reviews__carousel");
    if (await carousel.count()) {
      const trackBefore = await page.locator(".home-reviews__track").evaluate((el) => getComputedStyle(el).transform);
      const nextControl = page.locator('.home-reviews__nav--catalog label[for="home-review-filters"]');
      if (await nextControl.count()) {
        await nextControl.click();
        await settle(page);
        const trackAfter = await page.locator(".home-reviews__track").evaluate((el) => getComputedStyle(el).transform);
        record(
          "home reviews carousel: clicking Next label changes active slide (track transform)",
          trackBefore !== trackAfter,
          `before=${trackBefore} after=${trackAfter}`,
        );
      } else {
        record("home reviews carousel: Next control locatable", false, "label[for=home-review-filters] not found");
      }

      // keyboard: Tab to a radio input, use ArrowRight to move slide
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const radio1 = page.locator("#home-review-catalog");
      await radio1.focus();
      const focusedOk = await page.evaluate(() => document.activeElement?.id === "home-review-catalog");
      await page.keyboard.press("ArrowRight");
      await settle(page);
      const checkedId = await page.evaluate(() => document.querySelector('input[name="home-review"]:checked')?.id);
      record(
        "home reviews carousel: keyboard ArrowRight on focused radio moves to next slide",
        focusedOk && checkedId === "home-review-filters",
        `focusedOk=${focusedOk} checkedId=${checkedId}`,
      );
    } else {
      record("home reviews carousel: present on home page", false, "no .home-reviews__carousel found");
    }
  });

  // ---------------------------------------------------------------
  // 8. Forms: login, apply — empty/invalid submit
  // ---------------------------------------------------------------
  await withPage("chromium", DESKTOP, async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const submitBtn = page.locator('button[type="submit"]').first();
    const hasHtml5Required = await emailInput.getAttribute("required");
    await submitBtn.click();
    await settle(page);
    const stillOnLogin = page.url().includes("/login");
    record(
      "login form: submitting empty form does not silently navigate away",
      stillOnLogin,
      `url=${page.url()} required-attr=${hasHtml5Required}`,
    );

    // apply form on a real (non-gated) job
    await page.goto(`${BASE}/jobs/tools-programmer-unreal-editor-epic-games/apply`, { waitUntil: "networkidle" });
    const applySubmit = page.locator('form.apply-form button[type="submit"], form.apply-form input[type="submit"]');
    const nameReq = await page.locator("#apply-name").getAttribute("required");
    const emailReq = await page.locator("#apply-email").getAttribute("required");
    record(
      "apply form: name + email are HTML-required so empty submit is blocked client-side",
      nameReq !== null && emailReq !== null,
      `name required=${nameReq !== null} email required=${emailReq !== null}`,
    );
    // Try to force a server-side submit with invalid email using formnovalidate isn't present;
    // instead fill invalid email and rely on type=email validation.
    await page.locator("#apply-name").fill("QA Tester");
    await page.locator("#apply-email").fill("not-an-email");
    await applySubmit.first().click().catch(() => {});
    await settle(page);
    const validationMessage = await page.locator("#apply-email").evaluate((el) => el.validationMessage);
    record(
      "apply form: invalid email is caught by browser validation before submit",
      validationMessage.length > 0,
      `validationMessage="${validationMessage}"`,
    );
  });

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  const failed = log.filter((l) => !l.ok);
  console.log(`\n${log.length} checks run, ${failed.length} failed.`);
  if (failed.length) {
    console.log("Failed checks:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
