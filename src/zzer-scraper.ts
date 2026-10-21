import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import winston from "winston";

const ZZER_API_ENDPOINT = "https://gwapi-v2.goshare2.com/product/api/v1/product/detail";
const IMAGE_BASE_URL = "https://img.goshare2.com/";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;

const productSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().min(1),
  brand: z.string(),
  price: z.number().finite().nonnegative(),
  degree: z.enum(["A", "B", "C", "D", "N/A"]),
  images: z.array(z.string().url()),
  sku: z.string().default(""),
  originalPrice: z.number().finite().nonnegative().nullable().default(null),
  discount: z.number().finite().nonnegative().nullable().default(null),
  category: z.string().nullable().default(null),
  degreeExt: z.string().nullable().default(null),
  storeLocation: z.string().nullable().default(null),
  sellerName: z.string().nullable().default(null),
  authCertificateUrl: z.string().nullable().default(null),
  flaws: z.array(z.string()).default([]),
  attributes: z.array(z.unknown()).default([]),
  authenticityInfo: z.array(z.unknown()).default([]),
  productDetails: z.record(z.string(), z.unknown()).default({}),
  rawPayload: z.record(z.string(), z.unknown()).default({}),
});

export type ScrapedProduct = z.infer<typeof productSchema>;
type Degree = ScrapedProduct["degree"];

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

class MalformedApiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MalformedApiResponseError";
  }
}

class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}

class SupabaseIngestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SupabaseIngestError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MalformedApiResponseError(`Missing or invalid ${field}`);
  }
  return value.trim();
}

function parsePrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    throw new MalformedApiResponseError("Missing or invalid data.detail.price");
  }

  const normalized = value.trim().replace(/[¥￥,\s]/gu, "");
  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) {
    throw new MalformedApiResponseError("Missing or invalid data.detail.price");
  }

  const price = Number(normalized);
  if (!Number.isFinite(price)) {
    throw new MalformedApiResponseError("Missing or invalid data.detail.price");
  }
  return price;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/[¥￥,\s]/gu, "");
  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseDegreeValue(value: string): number | null {
  const numericMatch = value.match(/^(\d+(?:\.\d+)?)\s*(成新|新|%|％)?$/u);
  if (numericMatch) {
    let grade = Number(numericMatch[1]);
    if (numericMatch[2] === "%" || numericMatch[2] === "％" || (!numericMatch[2] && grade > 10)) {
      grade /= 10;
    }
    return grade;
  }

  const chineseMatch = value.match(/^(十|[一二三四五六七八九])(?:点([一二三四五六七八九]))?(?:成新|新)$/u);
  if (!chineseMatch) {
    return null;
  }

  const whole = chineseMatch[1] === "十" ? 10 : "一二三四五六七八九".indexOf(chineseMatch[1]) + 1;
  const fraction = chineseMatch[2]
    ? ("一二三四五六七八九".indexOf(chineseMatch[2]) + 1) / 10
    : 0;
  return whole + fraction;
}

/**
 * Maps 9.5-10 to A, 8.5-<9.5 to B, 7.5-<8.5 to C, and 6-<7.5 to D.
 * Missing, unparseable, and out-of-range grades become N/A.
 */
export function normalizeDegree(value: unknown): Degree {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
    return "N/A";
  }
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "N/A" || normalized === "NA") return "N/A";
    if (normalized === "A" || normalized === "B" || normalized === "C" || normalized === "D") {
      return normalized;
    }
    if (/^(全新|新品|未使用|十成新|10成新|10新)$/u.test(value.trim())) return "A";
  }

  const numericGrade = typeof value === "number"
    ? value > 10 && value <= 100 ? value / 10 : value
    : typeof value === "string"
      ? parseDegreeValue(value.trim())
      : null;

  if (numericGrade === null || !Number.isFinite(numericGrade) || numericGrade < 0 || numericGrade > 10) {
    return "N/A";
  }
  if (numericGrade >= 9.5) return "A";
  if (numericGrade >= 8.5) return "B";
  if (numericGrade >= 7.5) return "C";
  if (numericGrade >= 6) return "D";
  return "N/A";
}

function normalizeImage(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new MalformedApiResponseError("Invalid entry in data.detail.imageList");
  }

  let url: URL;
  try {
    url = new URL(value.trim(), IMAGE_BASE_URL);
  } catch {
    throw new MalformedApiResponseError("Invalid entry in data.detail.imageList");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new MalformedApiResponseError("Invalid entry in data.detail.imageList");
  }
  return url.href;
}

export function mapZzerProduct(responseBody: unknown): ScrapedProduct {
  if (!isRecord(responseBody) || !isRecord(responseBody.data)) {
    throw new MalformedApiResponseError("Missing data object in Zzer API response");
  }

  const data = responseBody.data;
  const detail = data.detail;
  const brand = data.brand;
  if (!isRecord(detail) || !isRecord(brand)) {
    throw new MalformedApiResponseError("Missing data.detail or data.brand in Zzer API response");
  }
  if (detail.imageList !== undefined && !Array.isArray(detail.imageList)) {
    throw new MalformedApiResponseError("Invalid data.detail.imageList");
  }

  const seller = isRecord(data.seller) ? data.seller : {};
  const report = isRecord(detail.identifyReportModuleV2)
    ? detail.identifyReportModuleV2
    : {};
  const rawDegree = detail.degreeDesc ?? detail.degree ?? detail.condition ?? null;
  const itemId = typeof detail.id === "string"
    ? detail.id.trim()
    : typeof detail.id === "number" && Number.isSafeInteger(detail.id)
      ? String(detail.id)
      : "";

  const degree = normalizeDegree(rawDegree);
  const degreeText = typeof rawDegree === "string" ? rawDegree.trim() : null;
  const explicitNotAvailable = degreeText !== null && /^(N\/A|NA)$/iu.test(degreeText);
  const missingDegree = rawDegree === undefined || rawDegree === null || degreeText === "";
  if (!missingDegree && !explicitNotAvailable && degree === "N/A") {
    logger.warn("Could not normalize product degree; using N/A", {
      productId: itemId,
      errorType: "DegreeNormalizationWarning",
      rawDegreeType: typeof rawDegree,
    });
  }

  const flawDetails = Array.isArray(detail.flawInfo) ? detail.flawInfo : [];
  const reportFlaws = Array.isArray(report.flaw) ? report.flaw : [];
  const normalizedFlaws = flawDetails.flatMap((entry): string[] => {
    if (!isRecord(entry)) return [];
    const name = typeof entry.flawName === "string" ? entry.flawName.trim() : "";
    const position = typeof entry.positionName === "string" ? entry.positionName.trim() : "";
    if (!name) return [];
    return [position ? position + ": " + name : name];
  });
  const flaws = Array.from(new Set([
    ...normalizedFlaws,
    ...reportFlaws.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0),
  ]));

  const attributes = Array.isArray(data.productAttrV2) ? data.productAttrV2 : [];
  const authenticityInfo = Array.isArray(data.question) ? data.question : [];
  const productImagesV1 = Array.isArray(detail.imageListV1)
    ? detail.imageListV1
    : Array.isArray(report.productImagesV1)
      ? report.productImagesV1
      : [];

  const productDetails: Record<string, unknown> = {
    raw_detail: detail,
    identify_report_module_v2: report,
    attributes,
    authenticity_info: authenticityInfo,
    image_list_v1: productImagesV1,
    category_main: detail.firstCategoryName ?? null,
    category_sub: detail.categoryTwo ?? null,
    store_id: detail.storeId ?? null,
    warehouse_code: detail.locationWarehouse ?? null,
    raw_degree: rawDegree,
  };

  const degreeExtValue = detail.degreeExtEn ?? detail.degreeExt;
  const storeLocationValue = detail.storeTextEn ?? detail.storeText ?? detail.locationWarehouse;
  const sellerNameValue = seller.nickName ?? detail.sellerName;
  const authCertificateValue = detail.authCertificateUrl ?? detail.certificateUrl ?? null;

  return productSchema.parse({
    itemId,
    title: requiredString(detail.name, "data.detail.name"),
    brand: requiredString(brand.name, "data.brand.name"),
    price: parsePrice(detail.price),
    degree,
    images: (detail.imageList ?? []).map(normalizeImage),
    sku: typeof detail.sku === "string" ? detail.sku : "",
    originalPrice: parseOptionalNumber(detail.originalPrice ?? detail.original_price),
    discount: parseOptionalNumber(detail.discount),
    category: typeof (detail.categoryTwo ?? detail.firstCategoryName) === "string"
      ? String(detail.categoryTwo ?? detail.firstCategoryName)
      : null,
    degreeExt: typeof degreeExtValue === "string" ? degreeExtValue : null,
    storeLocation: typeof storeLocationValue === "string" ? storeLocationValue : null,
    sellerName: typeof sellerNameValue === "string" ? sellerNameValue : null,
    authCertificateUrl: typeof authCertificateValue === "string" ? authCertificateValue : null,
    flaws,
    attributes,
    authenticityInfo,
    productDetails,
    rawPayload: responseBody,
  });
}

async function requestWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status < 500 || response.status > 599 || attempt === MAX_RETRIES) {
        return response;
      }
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
    }

    const delay = INITIAL_RETRY_DELAY_MS * 2 ** attempt;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
  }
  throw new Error("Request retry loop exited unexpectedly");
}

function getRequiredEnvironment(): { zzerToken: string; supabaseUrl: string; supabaseKey: string } {
  const zzerToken = process.env.ZZER_AUTH_TOKEN?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_KEY?.trim();
  if (!zzerToken || !supabaseUrl || !supabaseKey) {
    throw new Error("Missing required environment configuration");
  }

  try {
    const parsedUrl = new URL(supabaseUrl);
    if (!["https:", "http:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      throw new Error();
    }
  } catch {
    throw new Error("SUPABASE_URL must be a valid HTTP(S) URL");
  }

  return { zzerToken, supabaseUrl: supabaseUrl.replace(/\/+$/u, ""), supabaseKey };
}

function isCheckConstraintViolation(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(isCheckConstraintViolation);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(([key, entry]) =>
    (key.toLowerCase() === "code" && entry === "23514") || isCheckConstraintViolation(entry)
  );
}

async function parseJsonResponse(response: Response, source: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new MalformedApiResponseError(`Invalid JSON response from ${source}`);
  }
}

async function fetchProduct(productId: string, token: string): Promise<ScrapedProduct> {
  const url = new URL(ZZER_API_ENDPOINT);
  url.searchParams.set("id", productId);
  const response = await requestWithRetry(url.href, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "ZzerProductScraper/1.0 (Node.js)",
      Origin: "https://zzer.com",
      Referer: "https://zzer.com/",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new HttpStatusError(response.status, "Zzer product request failed");
  }
  return mapZzerProduct(await parseJsonResponse(response, "Zzer API"));
}

async function ingestProduct(
  product: ScrapedProduct,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<"ingested" | "constraint-warning"> {
  const zzerPayload: Record<string, unknown> = {
    itemId: product.itemId,
    title: product.title,
    brand: product.brand,
    selling_price_cny: product.price,
    photos: product.images,
    sku: product.sku,
    originalPrice: product.originalPrice,
    discount: product.discount,
    category: product.category,
    degreeExt: product.degreeExt,
    storeLocation: product.storeLocation,
    sellerName: product.sellerName,
    auth_certificate_url: product.authCertificateUrl,
    flaws: product.flaws,
    attributes: product.attributes,
    authenticityInfo: product.authenticityInfo,
    product_details: product.productDetails,
    raw_payload: product.rawPayload,
  };
  if (product.originalPrice !== null) {
    zzerPayload.original_price = product.originalPrice;
  }
  if (product.degree !== "N/A") {
    zzerPayload.condition_grade = product.degree;
  }

  const response = await requestWithRetry(`${supabaseUrl}/functions/v1/zzer-track-ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      zzer_payload: zzerPayload,
      captured_at: new Date().toISOString(),
    }),
  });

  const responseBody = await parseJsonResponse(response, "Supabase ingest");
  if (isCheckConstraintViolation(responseBody)) {
    logger.warn("Supabase rejected product due to a check constraint", {
      productId: product.itemId,
      errorType: "SupabaseCheckConstraintWarning",
      status: response.status,
    });
    return "constraint-warning";
  }
  if (!response.ok) {
    throw new SupabaseIngestError(response.status, "Supabase product ingest failed");
  }
  if (!isRecord(responseBody) || responseBody.ok !== true) {
    throw new SupabaseIngestError(response.status, "Supabase returned an unexpected ingest response");
  }
  return "ingested";
}

export async function runScraper(productId: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(productId)) {
    throw new Error("productId must contain 1-128 letters, digits, underscores, or hyphens");
  }

  const { zzerToken, supabaseUrl, supabaseKey } = getRequiredEnvironment();
  const product = await fetchProduct(productId, zzerToken);
  const result = await ingestProduct(product, supabaseUrl, supabaseKey);
  if (result === "ingested") {
    logger.info("Product ingested", { productId, degree: product.degree });
  }
}

async function main(args: string[]): Promise<void> {
  const productId = args[0];
  try {
    if (args.length !== 1) {
      throw new Error("Usage: npx tsx src/zzer-scraper.ts <productId>");
    }
    await runScraper(productId);
  } catch (error) {
    logger.error("Zzer product scraping failed", {
      productId: productId ?? null,
      errorType: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2));
}
