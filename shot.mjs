import { chromium } from "playwright";
const OUT = "/tmp/claude-1000/-home-andres-course-projects-logix/b2b16ed3-008d-4ccc-b714-b4870679e51e/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
await page.goto("http://localhost:8099/index.html", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Ejemplo guiado/ }).first().click();
await page.waitForTimeout(600);
const close = page.locator('button[aria-label="Cerrar guía"]');
if (await close.count()) await close.first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Construcción/ }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/refine-construccion.png`, fullPage: true });
// select the condition (3rd rail item)
const items = page.locator("#table-container li[data-row-id]");
if (await items.count() >= 3) { await items.nth(2).locator("button").first().click(); await page.waitForTimeout(400); }
await page.screenshot({ path: `${OUT}/refine-condicion.png`, fullPage: true });
await browser.close();
console.log("done");
