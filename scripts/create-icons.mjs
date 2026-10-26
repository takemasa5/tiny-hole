import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const svg = await readFile("public/icons/hole.svg", "utf8");
  await page.setContent(
    `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
  );
  for (const [size, name] of [
    [180, "apple-touch-icon"],
    [192, "hole-192"],
    [512, "hole-512"],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({ path: `public/icons/${name}.png` });
  }
} finally {
  await browser.close();
}
