const SUPABASE_URL = "https://<project-ref>.supabase.co";
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/zzer-ingest`;
const SUPABASE_ANON_KEY = "<replace-with-anon-key>";

function sendToSupabase(payload) {
  return fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  }).then(async (response) => {
    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return { ok: true, data };
  });
}

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

function handleZzerCapture(data) {
  const payload = normalizeProductPayload(data);
  if (!payload) return;

  sendToSupabase(payload).catch((error) => {
    console.error("Sandougi Zzer ingest failed:", error);
  });
}

const observeZzerTracking = () => {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const [input, init] = args;
    const url = typeof input === "string" ? input : input?.url || "";

    if (url.includes("gwapi-v2.goshare2.com") && typeof init?.body === "string") {
      try {
        const body = JSON.parse(init.body);
        handleZzerCapture(body);
      } catch {
        // ignore non-JSON or malformed responses
      }
    }

    return originalFetch(...args);
  };
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "zzer:product") {
    return false;
  }

  const payload = normalizeProductPayload(message.payload);
  if (!payload) {
    sendResponse({ ok: false, error: "Invalid Zzer product payload" });
    return false;
  }

  sendToSupabase(payload)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({ ok: false, error: error.message || "Unknown error" });
    });

  return true;
});

observeZzerTracking();

// --- SANDOUGI ZZER INTEGRATION START ---
const ZZER_TRACK_URL = "gwapi-v2.goshare2.com/producer/api/data/collect/track";

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!details.url.includes(ZZER_TRACK_URL)) return;
    if (details.method !== "POST") return;

    let body = null;
    if (details.requestBody && details.requestBody.raw) {
      const decoder = new TextDecoder("utf-8");
      body = decoder.decode(details.requestBody.raw[0].bytes);
    }

    if (body) {
      try {
        const payload = JSON.parse(body);
        fetch(`${SUPABASE_URL}/functions/v1/zzer-track-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            zzer_payload: payload,
            captured_at: new Date().toISOString(),
          }),
        }).catch((err) => {
          console.error("[Sandougi] Ingest error:", err);
        });
      } catch (error) {
        console.error("[Sandougi] Failed to parse Zzer body:", error);
      }
    }
  },
  { urls: ["*://gwapi-v2.goshare2.com/*"] },
  ["requestBody"],
);

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!details.url.includes(ZZER_TRACK_URL) || details.method !== "POST") {
      return;
    }

    if (details.requestBody && details.requestBody.raw) {
      try {
        const decoder = new TextDecoder("utf-8");
        const rawData = decoder.decode(details.requestBody.raw[0].bytes);
        const jsonData = JSON.parse(rawData);

        console.log("[Sandougi] Captured Zzer Data:", jsonData);

        fetch(`${SUPABASE_URL}/functions/v1/zzer-track-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            zzer_payload: jsonData,
            captured_at: new Date().toISOString(),
          }),
        }).then((res) => {
          if (!res.ok) {
            console.error("[Sandougi] Ingest failed:", res.status);
          }
        }).catch((err) => {
          console.error("[Sandougi] Ingest error:", err);
        });
      } catch (e) {
        console.error("[Sandougi] Failed to parse Zzer body:", e);
      }
    }
  },
  { urls: ["*://gwapi-v2.goshare2.com/*"] },
  ["requestBody"],
);
// --- SANDOUGI ZZER INTEGRATION END ---
