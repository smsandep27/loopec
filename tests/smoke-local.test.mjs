import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.LOOPEC_BASE_URL || "http://localhost:3000";

async function get(path) {
  const response = await fetch(new URL(path, baseUrl));
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  return response;
}

test("public landing page is available", async () => {
  const response = await get("/");
  const html = await response.text();
  assert.match(html, /LOOPEC/);
  assert.match(html, /Find a little more|Good things/);
});

test("developer marketplace preview shows sample listings without a data error", async () => {
  const response = await get("/marketplace");
  const html = await response.text();
  assert.match(html, /Developer preview/);
  assert.match(html, /Scientific calculator/);
  assert.doesNotMatch(html, /Marketplace data is not available/);
});

test("developer marketplace preview search and filters narrow sample listings", async () => {
  const [searchResponse, categoryResponse, priceResponse] = await Promise.all([
    get("/marketplace?q=lamp"),
    get("/marketplace?category=demo-books"),
    get("/marketplace?min=400&max=500"),
  ]);
  const [searchHtml, categoryHtml, priceHtml] = await Promise.all([
    searchResponse.text(),
    categoryResponse.text(),
    priceResponse.text(),
  ]);

  assert.match(searchHtml, /LED study lamp/);
  assert.doesNotMatch(searchHtml, /Scientific calculator/);
  assert.match(categoryHtml, /Engineering mathematics textbooks/);
  assert.doesNotMatch(categoryHtml, /LED study lamp/);
  assert.match(priceHtml, /Engineering mathematics textbooks/);
  assert.doesNotMatch(priceHtml, /Scientific calculator|LED study lamp/);
});

test("developer marketplace preview honors ascending and descending price sorts", async () => {
  const [lowResponse, highResponse] = await Promise.all([
    get("/marketplace?sort=price_low"),
    get("/marketplace?sort=price_high"),
  ]);
  const [lowHtml, highHtml] = await Promise.all([lowResponse.text(), highResponse.text()]);
  const nameOrder = (html) => [
    html.indexOf("LED study lamp"),
    html.indexOf("Engineering mathematics textbooks"),
    html.indexOf("Scientific calculator"),
  ];
  const lowOrder = nameOrder(lowHtml);
  const highOrder = nameOrder(highHtml);

  assert.ok(lowOrder[0] >= 0 && lowOrder[0] < lowOrder[1] && lowOrder[1] < lowOrder[2]);
  assert.ok(highOrder[2] >= 0 && highOrder[2] < highOrder[1] && highOrder[1] < highOrder[0]);
});

test("sign-in page explains the college account flow", async () => {
  const response = await get("/auth/sign-in");
  const html = await response.text();
  assert.match(html, /Sign in to LOOPEC/);
  assert.match(html, /college email address/i);
});

test("web manifest includes install-ready any and maskable icons", async () => {
  const response = await get("/manifest.webmanifest");
  const manifest = await response.json();
  assert.equal(manifest.short_name, "LOOPEC");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "any" && icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable" && icon.sizes === "512x512"));
});

test("service worker caches only the offline fallback", async () => {
  const response = await get("/sw.js");
  const script = await response.text();
  assert.match(script, /cache\.add\(OFFLINE_PAGE\)/);
  assert.doesNotMatch(script, /cache\.put\(/);
});

test("offline fallback and PWA image assets are served", async () => {
  const [offline, icon192, icon512, maskable, apple] = await Promise.all([
    get("/offline.html"),
    get("/icon-192.png"),
    get("/icon-512.png"),
    get("/icon-maskable-512.png"),
    get("/apple-touch-icon.png"),
  ]);
  assert.match(await offline.text(), /You’re out of the loop/);
  for (const response of [icon192, icon512, maskable, apple]) {
    assert.match(response.headers.get("content-type") || "", /image\/png/);
  }
});

test("razorpay webhook endpoint is reachable and handles requests securely", async () => {
  const response = await fetch(new URL("/api/webhooks/razorpay", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "ping" }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, "ok");
});

