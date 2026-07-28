const { chromium } = require("/home/user/Pukka-Sahib/node_modules/playwright");
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const p = await b.newPage({ viewportSize: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  p.on("pageerror", e => errs.push(String(e)));
  await p.goto("file://" + __dirname + "/index.html");
  await p.waitForTimeout(600);

  await p.screenshot({ path: "01-desk-empty.png" });
  await p.locator(".edge").first().click();          // pick the telegram
  await p.waitForTimeout(500);
  await p.screenshot({ path: "02-desk-held.png" });

  await p.locator(".stamp").nth(3).click();           // called for report
  await p.waitForTimeout(400);
  await p.locator(".edge").first().click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "03-desk-after.png" });

  await p.locator(".delegate").click();
  await p.waitForTimeout(350);
  await p.screenshot({ path: "04-delegate.png" });
  await p.locator(".cancel").click();

  await p.locator("#toRoad").click();
  await p.waitForTimeout(450);
  await p.locator('.stop[data-id="marwa"]').click();
  await p.locator('.stop[data-id="sirsa"]').click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: "05-road.png" });

  await p.locator("#setout").click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: "06-diary.png", fullPage: true });

  await p.locator("#backdesk2").click();
  await p.waitForTimeout(300);
  await p.locator(".endfn").click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "07-reckoning.png", fullPage: true });

  console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "clean");
  await b.close();
})();
