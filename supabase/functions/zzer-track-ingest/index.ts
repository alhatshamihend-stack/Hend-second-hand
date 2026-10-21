import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const EnvelopeSchema = z.object({
  zzer_payload: z.unknown().optional(),
  captured_at: z.string().optional(),
  timestamp: z.number().optional(),
});

const ProductSchema = z.object({
  zzer_item_id: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  condition_grade: z.enum(["S", "A", "B", "C", "D"]).optional(),
  selling_price_cny: z.number().nullable().optional(),
  original_price: z.number().nonnegative().default(0),
  original_price_cny: z.number().nonnegative().nullable().optional(),
  discount: z.number().nonnegative().default(0),
  sku: z.string().default(""),
  degree_ext: z.string().default(""),
  store_location: z.string().default(""),
  flaws: z.array(z.string()).default([]),
  seller_name: z.string().default(""),
  auth_certificate_url: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
  product_details: z.record(z.string(), z.unknown()).default({}),
  raw_payload: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const SUPABASE_URL =
  Deno.env.get("HENDSUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("HENDSUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase server environment configuration");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeItemId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/[¥￥,\s]/gu, "");
  if (!/^-?\d+(?:\.\d+)?$/u.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCondition(value: unknown): "S" | "A" | "B" | "C" | "D" | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;

  const upper = raw.toUpperCase();
  if (["S", "A", "B", "C", "D"].includes(upper)) {
    return upper as "S" | "A" | "B" | "C" | "D";
  }

  const lower = raw.toLowerCase();
  if (["new", "as new", "som ny", "ny", "like new", "like-new", "likenew", "excellent", "very good", "very_good", "全新", "新品", "未使用", "十成新", "10成新", "10新"].includes(lower)) {
    return "A";
  }
  if (["good", "bra", "gott", "good condition", "in good condition"].includes(lower)) {
    return "B";
  }
  if (["fair", "acceptable", "used"].includes(lower)) return "C";
  if (["poor", "heavily used"].includes(lower)) return "D";

  const match = raw.match(/\d+(?:\.\d+)?/u);
  if (!match) return undefined;

  let grade = Number(match[0]);
  if (raw.includes("%") || raw.includes("％") || (grade > 10 && grade <= 100)) {
    grade /= 10;
  }
  if (!Number.isFinite(grade) || grade < 6 || grade > 10) return undefined;
  if (grade >= 9.5) return "A";
  if (grade >= 8.5) return "B";
  if (grade >= 7.5) return "C";
  return "D";
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//iu.test(trimmed)) return trimmed;
  return "https://img.goshare2.com/" + trimmed.replace(/^\/+/u, "");
}

function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): string[] => {
    let url: unknown;
    if (typeof entry === "string") {
      url = entry;
    } else if (isRecord(entry)) {
      if (typeof entry.type === "number" && entry.type !== 0) return [];
      url = entry.url ?? entry.src ?? entry.image ?? entry.photo;
    }
    if (typeof url !== "string" || !url.trim()) return [];
    return [normalizeImageUrl(url)];
  });
}

function normalizeFlawText(entry: unknown): string | null {
  if (typeof entry === "string" && entry.trim()) return entry.trim();
  if (!isRecord(entry)) return null;

  const name = firstString(entry.flawName, entry.name, entry.description);
  const position = firstString(entry.positionName, entry.position);
  if (!name) return null;
  return position ? position + ": " + name : name;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map(normalizeFlawText)
      .filter((value): value is string => value !== null),
  ));
}

function normalizePayloadToZzerRow(
  raw: unknown,
  capturedAt: string | undefined,
) {
  if (!isRecord(raw)) throw new Error("Invalid payload: expected an object");

  const wrapperDetails = isRecord(raw.product_details)
    ? raw.product_details
    : isRecord(raw.productDetails)
    ? raw.productDetails
    : {};

  const data = isRecord(raw.data) ? raw.data : raw;
  const detail = isRecord(raw.detail)
    ? raw.detail
    : isRecord(data.detail)
    ? data.detail
    : isRecord(raw.raw_detail)
    ? raw.raw_detail
    : isRecord(wrapperDetails.raw_detail)
    ? wrapperDetails.raw_detail
    : raw;

  const report = isRecord(detail.identifyReportModuleV2)
    ? detail.identifyReportModuleV2
    : isRecord(wrapperDetails.identify_report_module_v2)
    ? wrapperDetails.identify_report_module_v2
    : isRecord(wrapperDetails.identificationReport)
    ? wrapperDetails.identificationReport
    : {};

  const brandObject = isRecord(data.brand) ? data.brand : {};
  const seller = isRecord(data.seller) ? data.seller : {};

  const itemId = normalizeItemId(
    raw.itemId ?? raw.id ?? raw.zzer_item_id ?? raw.product_id ??
      raw.uuid ?? detail.id,
  );
  const title = firstString(raw.title, raw.name, detail.name, detail.title);
  if (!itemId || !title) {
    throw new Error("Missing required zzer_item_id or title");
  }

  const rawGrade = raw.condition_grade ?? raw.grade ?? raw.condition ??
    raw.degree ?? detail.degreeDesc ?? detail.degree ?? detail.condition;
  const condition = normalizeCondition(rawGrade);

  const price = toNumber(
    raw.selling_price_cny ?? raw.price_cny ?? raw.price ??
      raw.sale_price ?? detail.price ?? detail.salePrice ?? detail.currentPrice,
  );
  const originalPrice = toNumber(
    raw.originalPrice ?? raw.original_price ?? raw.original_price_cny ??
      detail.originalPrice ?? detail.original_price,
  );
  const photos = normalizePhotos(
    raw.photos ?? raw.images ?? raw.image_urls ?? raw.media ??
      detail.imageList ?? detail.imageListV1 ?? report.productImagesV1,
  );

  const flawItems = Array.isArray(detail.flawInfo) ? detail.flawInfo : [];
  const reportFlaws = Array.isArray(report.flaw) ? report.flaw : [];
  const suppliedFlaws = Array.isArray(raw.flaws) ? raw.flaws :
    Array.isArray(raw.defects) ? raw.defects : [];
  const flaws = uniqueStrings([
    ...suppliedFlaws,
    ...flawItems,
    ...reportFlaws,
  ]);

  const attributes = Array.isArray(raw.attributes)
    ? raw.attributes
    : Array.isArray(data.productAttrV2)
    ? data.productAttrV2
    : Array.isArray(wrapperDetails.attributes)
    ? wrapperDetails.attributes
    : [];

  const authenticityInfo = Array.isArray(raw.authenticityInfo)
    ? raw.authenticityInfo
    : Array.isArray(data.question)
    ? data.question
    : Array.isArray(wrapperDetails.authenticity_info)
    ? wrapperDetails.authenticity_info
    : [];

  const imageListV1 = Array.isArray(detail.imageListV1)
    ? detail.imageListV1
    : Array.isArray(report.productImagesV1)
    ? report.productImagesV1
    : [];

  const productDetails: JsonRecord = {
    ...wrapperDetails,
    raw_detail: isRecord(raw.raw_detail)
      ? raw.raw_detail
      : isRecord(wrapperDetails.raw_detail)
      ? wrapperDetails.raw_detail
      : detail,
    identify_report_module_v2: report,
    attributes,
    authenticity_info: authenticityInfo,
    image_list_v1: imageListV1,
    flaw_details: {
      items: flawItems,
      descriptions: reportFlaws,
      images: imageListV1.filter(
        (entry) => isRecord(entry) && entry.type === 1,
      ),
    },
    category_main: raw.categoryMain ?? detail.firstCategoryName ?? null,
    category_sub: raw.categorySub ?? detail.categoryTwo ?? null,
    store_id: raw.storeId ?? detail.storeId ?? null,
    warehouse_code: raw.storeWarehouse ?? detail.locationWarehouse ?? null,
    raw_degree: rawGrade ?? null,
    captured_at: capturedAt ?? new Date().toISOString(),
  };

  const rawPayloadCandidate = raw.raw_payload ?? raw.rawPayload;
  const rawPayload = isRecord(rawPayloadCandidate)
    ? rawPayloadCandidate
    : raw;

  const originalPriceValue = originalPrice ?? 0;
  const rawCategory = firstString(
    raw.category,
    detail.categoryTwo,
    detail.firstCategoryName,
  );
  const rawStoreLocation = firstString(
    raw.storeLocation,
    detail.storeTextEn,
    detail.storeText,
    detail.locationWarehouse,
  );
  const rawSellerName = firstString(
    raw.sellerName,
    seller.nickName,
    detail.sellerName,
  );

  return {
    zzer_item_id: itemId,
    title,
    brand: firstString(
      typeof raw.brand === "string" ? raw.brand : null,
      typeof detail.brand === "string" ? detail.brand : null,
      raw.vendor,
      brandObject.name,
    ),
    category: rawCategory,
    condition_grade: condition,
    selling_price_cny: price,
    original_price: originalPriceValue,
    original_price_cny: originalPrice,
    discount: toNumber(raw.discount ?? detail.discount) ?? 0,
    sku: firstString(raw.sku, detail.sku) ?? "",
    degree_ext: firstString(
      raw.degreeExt,
      raw.degree_ext,
      detail.degreeExtEn,
      detail.degreeExt,
    ) ?? "",
    store_location: rawStoreLocation ?? "",
    flaws,
    seller_name: rawSellerName ?? "",
    auth_certificate_url: firstString(
      raw.auth_certificate_url,
      raw.certificate_url,
      detail.authCertificateUrl,
      detail.certificateUrl,
    ),
    photos,
    product_details: productDetails,
    raw_payload: rawPayload,
    created_at: firstString(raw.created_at) ?? undefined,
    updated_at: new Date().toISOString(),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body: unknown = await req.json();
    const parsedEnvelope = EnvelopeSchema.safeParse(body);
    const hasEnvelope = isRecord(body) &&
      Object.prototype.hasOwnProperty.call(body, "zzer_payload");
    const raw = hasEnvelope && isRecord(body)
      ? body.zzer_payload
      : body;
    const capturedAt = parsedEnvelope.success
      ? parsedEnvelope.data.captured_at
      : undefined;

    const normalized = normalizePayloadToZzerRow(raw, capturedAt);
    const now = new Date().toISOString();

    const { data: existing, error: lookupError } = await supabase
      .from("products_zzer")
      .select("created_at")
      .eq("zzer_item_id", normalized.zzer_item_id)
      .maybeSingle();

    if (lookupError) {
      console.error("Existing product lookup failed:", lookupError);
      return jsonResponse({
        ok: false,
        error: "Could not check existing product",
      }, 500);
    }

    const validated = ProductSchema.parse({
      ...normalized,
      created_at: normalized.created_at ?? existing?.created_at ?? now,
      updated_at: now,
    });

    const { data, error } = await supabase
      .from("products_zzer")
      .upsert(validated, { onConflict: "zzer_item_id" })
      .select("*")
      .single();

    if (error) {
      console.error("Supabase upsert error:", error);
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    return jsonResponse({
      ok: true,
      action: existing ? "updated" : "inserted",
      zzer_item_id: validated.zzer_item_id,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("ZZER ingest error:", message);
    return jsonResponse({ ok: false, error: message }, 400);
  }
});
