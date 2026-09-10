import { chromium } from "playwright";
const OUT = "/tmp/claude-1000/-home-andres-course-projects-logix/b2b16ed3-008d-4ccc-b714-b4870679e51e/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
await page.goto("http://localhost:8099/index.html", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const skip = page.getByText("Omitir", { exact: true });
if (await skip.count()) await skip.first().click();
await page.waitForTimeout(200);
// activate statement so Datos shows columns with source
for (const [name, file] of [["Datos", "empty-datos"], ["Construcción", "empty-construccion"], ["Cadena", "empty-cadena"]]) {
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${file}.png` });
}
await browser.close();
console.log("done");
