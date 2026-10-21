const ZZER_TRACK_HOST = "gwapi-v2.goshare2.com";
const ZZER_TRACK_PATH = "/producer/api/data/collect/track";

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

    // This endpoint is analytics, not the full product-detail response.
    // Never save it automatically: it may contain partial data and overwrite rich records.
    console.info(
      "[Sandougi] Zzer track event observed; not uploaded. Use the explicit product-ID scraper for product capture.",
    );
  },
  { urls: ["https://" + ZZER_TRACK_HOST + ZZER_TRACK_PATH + "*"] },
  ["requestBody"],
);
