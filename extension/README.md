# Sandougi Zzer Connector (legacy experiment)

This directory contains an earlier Chrome extension experiment. It is **not the primary product-ingestion path** and currently does not save product data.

The request `POST https://gwapi-v2.goshare2.com/producer/api/data/collect/track` is an analytics/track request, not a dependable full product-detail response. The background worker only logs that event and intentionally does not upload it. The obsolete `zzer:product` message writer has been removed because it targeted an unavailable ingest function and could not work with the authenticated `zzer-track-ingest` endpoint.

## Current supported capture path

Use the standalone TypeScript scraper documented in the root [README](../README.md). It takes one explicit product ID and fetches only that product's detail endpoint. It does not walk listing pages or automatically follow related-product lists.

## Future extension work

Do not re-enable automatic track-event ingestion. If extension-based capture is resumed, implement a visible user action such as **Save this product**, bind it to the product ID selected by the user, and forward the matching detail response only after that action. Never put a Supabase service-role/secret key in extension code; the browser can only use a public client key and a properly protected backend endpoint. The extension currently has no Save button or product-ingest pathway.
