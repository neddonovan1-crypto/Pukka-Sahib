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

  // Motion is not judged from one still, so the two journeys are also shot as
  // sequences: light frames (css scale, desk only) taken as fast as the
  // browser will hand them over, which is roughly every 120ms.
  const desk = { clip: { x: 0, y: 60, width: 1280, height: 740 }, scale: "css" };
  // wide enough to hold the rack and the sheet at once, small enough that the
  // browser hands the frames back every ~150ms
  const blotter = { clip: { x: 330, y: 270, width: 860, height: 430 }, scale: "css" };

  await p.locator(".hung").first().click();          // pick the telegram
  await p.waitForTimeout(90);
  await p.screenshot({ path: "02a-takedown.png", ...desk });   // the sheet in the air
  await p.waitForTimeout(600);
  await p.screenshot({ path: "02-desk-held.png" });

  // one strike, frame by frame: out of the rack, across, down onto the sheet,
  // the mark, and the sheet away to the tray
  await p.locator(".stamp").nth(3).click();           // called for report
  for (let i = 1; i <= 6; i++) {
    await p.screenshot({ path: "02s" + i + "-strike.png", ...blotter });
  }
  await p.waitForTimeout(900);

  // A frame costs about 150ms to hand over and the die is only on the paper
  // for about 100, so contact is caught on a second paper with a timed wait
  // rather than hoped for in the run above.
  await p.locator(".hung").first().click();
  await p.waitForTimeout(600);
  await p.locator(".stamp").nth(0).click();
  await p.waitForTimeout(505);
  await p.screenshot({ path: "02c-contact.png", ...blotter });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: "03-desk-after.png" });

  await p.locator(".delegate").click();
  await p.waitForTimeout(350);
  await p.screenshot({ path: "04-delegate.png" });
  await p.locator(".cancel").click();

  await p.locator("#toRoad").click();
  await p.waitForTimeout(450);
  await p.locator('.pin').nth(0).click();
  await p.locator('.pin').nth(2).click();
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
