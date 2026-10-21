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

test("maps English condition aliases to the shared A-D grade scale", () => {
  const cases: Array<[unknown, string]> = [
    ["new", "A"],
    ["like new", "A"],
    ["excellent", "A"],
    ["very good", "A"],
    ["good", "B"],
    ["bra", "B"],
    ["fair", "C"],
    ["poor", "D"],
    ["e", "N/A"],
  ];

  for (const [rawGrade, expected] of cases) {
    assert.equal(normalizeDegree(rawGrade), expected, "alias " + String(rawGrade));
  }
});

test("preserves extended details from the real Zzer API response shape", () => {
  const raw = {
    code: "100000",
    data: {
      detail: {
        id: "2585638151251599365",
        sku: "261008782292135",
        name: "Gucci shoulder bag",
        price: "5000",
        originalPrice: "12000",
        discount: 4.1,
        brand: "Gucci",
        degreeDesc: "9.5新",
        degreeExtEn: "Light signs of use",
        firstCategoryName: "包袋",
        categoryTwo: "单肩包",
        storeId: 40,
        storeTextEn: "Beijing B8-7",
        locationWarehouse: "B8-7",
        imageList: ["product-images/main.jpg"],
        imageListV1: [
          { type: 0, url: "product-images/main.jpg" },
          { type: 1, url: "product-original-images/flaw.jpg", name: "轻微内里污渍" },
        ],
        flawInfo: [
          { positionName: "外观", flawName: "轻微包身整体磨损" },
        ],
        identifyReportModuleV2: {
          flaw: ["轻微内里污渍", "轻微肩带磨损"],
          maintain: [{ type: "维修痕迹", names: [] }],
          productImagesV1: [
            { type: 0, url: "product-images/main.jpg" },
            { type: 1, url: "product-original-images/flaw.jpg", name: "轻微内里污渍" },
          ],
        },
      },
      brand: { name: "Gucci" },
      seller: { nickName: "188****0088" },
      productAttrV2: [
        {
          fieldId: "proc_material_bag",
          name: "材质",
          nameEn: "Material",
          values: [{ value: "牛皮" }, { value: "帆布" }],
        },
      ],
      question: [
        { name: "正品鉴别", nameEn: "Authenticity Verification", value: "已鉴别" },
      ],
    },
    msg: "成功",
  };

  const product = mapZzerProduct(raw);

  assert.equal(product.itemId, "2585638151251599365");
  assert.equal(product.sku, "261008782292135");
  assert.equal(product.originalPrice, 12000);
  assert.equal(product.discount, 4.1);
  assert.equal(product.category, "单肩包");
  assert.equal(product.storeLocation, "Beijing B8-7");
  assert.equal(product.sellerName, "188****0088");
  assert.equal(product.degree, "A");
  assert.equal(product.flaws.includes("外观: 轻微包身整体磨损"), true);
  assert.equal(product.flaws.includes("轻微内里污渍"), true);
  assert.equal(product.attributes.length, 1);
  assert.equal(product.authenticityInfo.length, 1);
  assert.equal(product.productDetails.raw_detail !== undefined, true);
  assert.equal(
    ((product.rawPayload.data as Record<string, unknown>).detail as Record<string, unknown>).id,
    "2585638151251599365",
  );
});

test("supports defectList as a fallback for flawInfo", () => {
  const raw = {
    data: {
      detail: {
        id: "defect-list-product",
        name: "Test bag with defects",
        price: "2850",
        degreeDesc: "9.5新",
        defectList: [
          { name: "Scuff on toe" },
          "Light sole wear",
          { desc: "Loose stitch", position: "Interior" },
          { name: "  " },
          null,
        ],
      },
      brand: { name: "Test brand" },
    },
  };

  const product = mapZzerProduct(raw);
  assert.deepEqual(product.flaws, [
    "Scuff on toe",
    "Light sole wear",
    "Interior: Loose stitch",
  ]);
});

test("ingests a valid N/A grade without sending condition_grade", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = {
    zzerToken: process.env.ZZER_AUTH_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  let ingestBody: Record<string, unknown> | undefined;

  process.env.ZZER_AUTH_TOKEN = "test-token";
  process.env.SUPABASE_URL = "https://project.example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
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
    restoreEnvironment("SUPABASE_SERVICE_ROLE_KEY", originalEnvironment.supabaseKey);
  }
});

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
