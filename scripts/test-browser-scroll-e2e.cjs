const { chromium } = require("playwright");

async function runBrowserTest() {
  console.log("=================================================================");
  console.log("🌐 STARTING CRITICAL REAL BROWSER TEST (PLAYWRIGHT HEADLESS)");
  console.log("=================================================================");

  const errors = [];
  const warnings = [];

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  page.on("pageerror", (err) => {
    console.error("🔴 Browser Page Error:", err.message);
    errors.push(err.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter harmless dev/analytics network errors if any
      if (text.includes("split")) {
        console.error("🔴 Browser Console Error (SPLIT):", text);
        errors.push(text);
      }
    }
  });

  const baseUrl = "http://localhost:3000";

  try {
    // 1. Buka Homepage
    console.log("1. Opening homepage:", baseUrl);
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    // 2. Scroll perlahan dari atas sampai paling bawah
    console.log("2. Scrolling slowly from top to bottom on homepage...");
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < scrollHeight; y += 300) {
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), y);
      await page.waitForTimeout(80);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Verify page content still exists and did not crash
    const homeContentExists = await page.evaluate(() => {
      const root = document.getElementById("root");
      return root && root.children.length > 0 && root.innerText.length > 200;
    });
    if (!homeContentExists) {
      throw new Error("Homepage content disappeared or root crashed after scrolling down!");
    }
    console.log("   ✅ Homepage scrolled to bottom successfully without crash.");

    // 3. Scroll naik kembali
    console.log("3. Scrolling back up to top...");
    for (let y = scrollHeight; y > 0; y -= 400) {
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), y);
      await page.waitForTimeout(50);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    console.log("   ✅ Homepage scrolled up successfully.");

    // 4. Buka halaman Private Tour
    console.log("4. Navigating to Private Tour page (#tours)...");
    await page.evaluate(() => { window.location.hash = "#tours"; });
    await page.waitForTimeout(1500);

    // 5. Scroll sampai bawah di Private Tour
    console.log("5. Scrolling down on Private Tour page...");
    const toursScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < toursScrollHeight; y += 300) {
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    const toursContentExists = await page.evaluate(() => {
      const root = document.getElementById("root");
      return root && root.children.length > 0 && root.innerText.length > 200;
    });
    if (!toursContentExists) {
      throw new Error("Private Tour content disappeared or root crashed!");
    }
    console.log("   ✅ Private Tour page rendered and scrolled without crash.");

    // 6. Buka halaman Share Tour/Open Trip public
    console.log("6. Navigating to Share Tour/Open Trip public (#share-tour)...");
    await page.evaluate(() => { window.location.hash = "#share-tour"; });
    await page.waitForTimeout(1500);

    // 7. Scroll sampai bawah di Share Tour
    console.log("7. Scrolling down on Share Tour page...");
    const shareScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < shareScrollHeight; y += 300) {
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), y);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(500);
    const shareContentExists = await page.evaluate(() => {
      const root = document.getElementById("root");
      return root && root.children.length > 0 && root.innerText.length > 200;
    });
    if (!shareContentExists) {
      throw new Error("Share Tour content disappeared or root crashed!");
    }
    console.log("   ✅ Share Tour page rendered and scrolled without crash.");

    // 8. Kembali ke homepage
    console.log("8. Navigating back to homepage (#home)...");
    await page.evaluate(() => { window.location.hash = "#home"; });
    await page.waitForTimeout(1500);

    // 9. Scroll lagi
    console.log("9. Scrolling again on homepage...");
    for (let y = 0; y < scrollHeight; y += 300) {
      await page.evaluate((scrollPos) => window.scrollTo(0, scrollPos), y);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(500);
    console.log("   ✅ Second homepage scroll completed without crash.");

    // Final checks
    const splitErrors = errors.filter(e => e.toLowerCase().includes("split"));
    if (splitErrors.length > 0) {
      throw new Error(`CRITICAL: Detected split crash in browser: ${splitErrors.join("; ")}`);
    }

    if (errors.length > 0) {
      throw new Error(`Errors detected: ${errors.join("; ")}`);
    }

    console.log("=================================================================");
    console.log("🏆 CRITICAL REAL BROWSER TEST: 100% PASSED (NO SPLIT CRASH)");
    console.log("=================================================================");
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ BROWSER TEST FAILED:", err.message);
    await browser.close();
    process.exit(1);
  }
}

runBrowserTest();
