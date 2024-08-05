import puppeteer from "puppeteer";
import { writeFile } from "fs/promises";

interface IOptions {
  url: string,
  outputFile: string,

  // The width of the browser window. The height is determined dynamically.
  // Default: 1920 /2
  windowWidth?: number
}

export async function makeCLUEScreenshot({
  url,
  outputFile,
  windowWidth
}: IOptions) {
  console.log(`*   Processing screenshot`, url);


  // View the document in the document editor
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(url, {
      timeout: 60000, // 30 seconds
      waitUntil: 'networkidle0'
    });
  } catch (error) {
    await page.close();
    await browser.close();
    throw new Error(`Failed to load file ${url}`, {cause: error});
  }

  await page.evaluate(() => {
    (window as any).docEditorSettings.setShowLocalReadOnly(false);
    (window as any).docEditorSettings.setShowRemoteReadOnly(false);
  });

  // Approximate the height of the document by adding up the heights of the rows and make the viewport that tall
  let pageHeight = 30;
  const rowElements = await page.$$(".tile-row");
  for (const rowElement of rowElements) {
    const boundingBox = await rowElement.boundingBox();
    pageHeight += boundingBox?.height ?? 0;
  }
  const width = windowWidth || 1920 / 2;
  await page.setViewport({ width, height: Math.round(pageHeight) });

  // Take a screenshot and save it to a file
  const buffer = await page.screenshot({ fullPage: true, type: 'png' });
  await page.close();
  await browser.close();
  await writeFile(outputFile, buffer);
}
