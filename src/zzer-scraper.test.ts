import assert from "node:assert/strict";
import { test } from "node:test";
import { mapZzerProduct, normalizeDegree, runScraper } from "./zzer-scraper.js";

const makeProductResponse = (degreeDesc?: unknown, imageList?: unknown) => ({
  data: {
    detail: {
      id: "test-product",
      name: "Test bag",
      price: "2850",
      ...(degreeDesc === undefined ? {} : { degreeDesc }),
      ...(imageList === undefined ? {} : { imageList }),
    },
    brand: { name: "Test brand" },
  },
});

test("normalizes requested degree bands including fractional boundaries", () => {
  const cases: Array<[unknown, string]> = [
    ["9.5新", "A"],
    ["9.49新", "B"],
    ["8.5新", "B"],
    ["8.49新", "C"],
    ["7.5成新", "C"],
    ["7.49新", "D"],
    ["6新", "D"],
    ["5.99新", "N/A"],
    ["10.1新", "N/A"],
    ["not a grade", "N/A"],
    [undefined, "N/A"],
  ];

  for (const [rawGrade, expected] of cases) {
    assert.equal(normalizeDegree(rawGrade), expected, `grade ${String(rawGrade)}`);
  }
});

test("defaults a missing imageList to an empty array and validates supplied entries", () => {
  assert.deepEqual(mapZzerProduct(makeProductResponse("9新")).images, []);
  assert.deepEqual(
    mapZzerProduct(makeProductResponse("9新", ["/bag.jpg"])).images,
    ["https://img.goshare2.com/bag.jpg"],
  );
  assert.throws(() => mapZzerProduct(makeProductResponse("9新", ["javascript:alert(1)"])));
  assert.throws(() => mapZzerProduct(makeProductResponse("9新", "not-an-array")));
});

test("ingests a valid N/A grade without sending condition_grade", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    zzerToken: process.env.ZZER_AUTH_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
  };
  let ingestBody: Record<string, unknown> | undefined;

  process.env.ZZER_AUTH_TOKEN = "test-token";
  process.env.SUPABASE_URL = "https://project.example.supabase.co";
  process.env.SUPABASE_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://gwapi-v2.goshare2.com/")) {
      return Response.json(makeProductResponse("5新"));
    }

    ingestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ ok: true, data: null });
  };

  try {
    await runScraper("test-product");
    assert.ok(ingestBody);
    const payload = ingestBody.zzer_payload as Record<string, unknown>;
    assert.equal(payload.itemId, "test-product");
    assert.equal("condition_grade" in payload, false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment("ZZER_AUTH_TOKEN", originalEnvironment.zzerToken);
    restoreEnvironment("SUPABASE_URL", originalEnvironment.supabaseUrl);
    restoreEnvironment("SUPABASE_KEY", originalEnvironment.supabaseKey);
  }
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
