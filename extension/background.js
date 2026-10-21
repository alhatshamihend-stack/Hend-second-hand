const SUPABASE_FUNCTIONS_PATH = "/functions/v1/";
const ZZER_TRACK_HOST = "gwapi-v2.goshare2.com";
const ZZER_TRACK_PATH = "/producer/api/data/collect/track";

function normalizeProductPayload(raw) {
  if (!raw || typeof raw !== "object") return null;

  const product = raw.product || raw.data || raw.payload || raw;

  if (!product || typeof product !== "object") return null;

  const id = product.id || product.product_id || product.uuid || product.handle;
  const title = product.title || product.name || product.product_name;
  const handle = product.handle || product.slug || String(title || "").toLowerCase().replace(/\s+/g, "-");

  if (!id || !title) return null;

  return {
    id: String(id),
    title: String(title),
    handle: String(handle),
    body_html: product.body_html || product.description || null,
    vendor: product.vendor || product.brand || null,
    product_type: product.product_type || product.category || null,
    status: product.status || "active",
    tags: Array.isArray(product.tags) ? product.tags : [],
    images: Array.isArray(product.images) ? product.images : [],
    variants: Array.isArray(product.variants) ? product.variants : [],
    options: Array.isArray(product.options) ? product.options : [],
    source: "zzer",
  };
}

async function getSupabaseConfig() {
  const { supabaseProjectUrl, supabaseAnonKey } = await chrome.storage.local.get([
    "supabaseProjectUrl",
    "supabaseAnonKey",
  ]);

  if (typeof supabaseProjectUrl !== "string" || typeof supabaseAnonKey !== "string" ||
      !supabaseProjectUrl.trim() || !supabaseAnonKey.trim()) {
    throw new Error("Supabase is not configured in chrome.storage.local");
  }

  let projectUrl;
  try {
    projectUrl = new URL(supabaseProjectUrl.trim());
  } catch {
    throw new Error("Supabase project URL is invalid");
  }

  if (projectUrl.protocol !== "https:" || !projectUrl.hostname.endsWith(".supabase.co") ||
      projectUrl.username || projectUrl.password || projectUrl.pathname !== "/" ||
      projectUrl.search || projectUrl.hash) {
    throw new Error("Supabase project URL must be an HTTPS Supabase project URL");
  }

  return {
    projectUrl: projectUrl.origin,
    anonKey: supabaseAnonKey.trim(),
  };
}

async function sendToSupabase(functionName, payload) {
  const { projectUrl, anonKey } = await getSupabaseConfig();
  const response = await fetch(new URL(`${SUPABASE_FUNCTIONS_PATH}${functionName}`, projectUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  console.log("[Zzer Background] Supabase svar:", redactSecret(data, anonKey));

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return { ok: true, data };
}

function redactSecret(value, secret) {
  if (typeof value === "string") return value.split(secret).join("[REDACTED]");
  if (Array.isArray(value)) return value.map((entry) => redactSecret(entry, secret));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactSecret(entry, secret)]),
    );
  }
  return value;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "zzer:product") {
    return false;
  }

  const payload = normalizeProductPayload(message.payload);
  if (!payload) {
    sendResponse({ ok: false, error: "Invalid Zzer product payload" });
    return false;
  }

  sendToSupabase("zzer-ingest", payload)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({ ok: false, error: error.message || "Unknown error" });
    });

  return true;
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "POST") return;

    let requestUrl;
    try {
      requestUrl = new URL(details.url);
    } catch {
      return;
    }

    if (
      requestUrl.protocol !== "https:" ||
      requestUrl.hostname !== ZZER_TRACK_HOST ||
      requestUrl.pathname !== ZZER_TRACK_PATH
    ) {
      return;
    }

    // This endpoint is an analytics/track request, not the full product-detail response.
    // Never upsert it automatically: it may contain partial data and overwrite rich records.
    console.info(
      "[Sandougi] Zzer track event observed; not uploaded. Use the explicit product-ID scraper for product capture.",
    );
  },
  { urls: ["https://" + ZZER_TRACK_HOST + ZZER_TRACK_PATH + "*"] },
  ["requestBody"],
);
