import { chromium, firefox, webkit } from "@playwright/test";
for (const [name, launcher] of [["chromium", chromium], ["firefox", firefox], ["webkit", webkit]]) {
  const browser = await launcher.launch();
  const page = await browser.newPage();
  const supported = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
  console.log(name, "supports animation-timeline: view():", supported);
  await browser.close();
}
