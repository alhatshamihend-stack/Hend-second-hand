const SUPABASE_FUNCTIONS_PATH = "/functions/v1/";
const ZZER_TRACK_HOST = "gwapi-v2.goshare2.com";
const ZZER_TRACK_PATH = "/producer/api/data/collect/track";
let missingConfigurationWarningLogged = false;

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

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return { ok: true, data };
}

function parseRequestBody(details) {
  const chunks = details.requestBody?.raw
    ?.map((entry) => entry.bytes)
    .filter((bytes) => bytes instanceof ArrayBuffer);
  if (!chunks?.length) return null;

  const byteLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const bodyBytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder("utf-8").decode(bodyBytes));
  } catch {
    return null;
  }
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

    const requestUrl = new URL(details.url);
    if (requestUrl.hostname !== ZZER_TRACK_HOST || requestUrl.pathname !== ZZER_TRACK_PATH) return;

    const zzerPayload = parseRequestBody(details);
    if (zzerPayload === null) {
      console.warn("[Sandougi] Skipped Zzer track request with no valid JSON body.");
      return;
    }

    sendToSupabase("zzer-track-ingest", {
      zzer_payload: zzerPayload,
      captured_at: new Date().toISOString(),
    }).catch((error) => {
      const message = error.message || "Unknown error";
      if (message.includes("not configured")) {
        if (!missingConfigurationWarningLogged) {
          console.warn("[Sandougi] Configure Supabase in chrome.storage.local to enable Zzer track forwarding.");
          missingConfigurationWarningLogged = true;
        }
        return;
      }
      console.error("[Sandougi] Zzer track ingest failed:", message);
    });
  },
  { urls: [`*://${ZZER_TRACK_HOST}${ZZER_TRACK_PATH}*`] },
  ["requestBody"],
);
