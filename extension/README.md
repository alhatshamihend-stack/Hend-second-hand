# Sandougi Zzer Connector

The extension forwards the JSON body of `POST https://gwapi-v2.goshare2.com/producer/api/data/collect/track`
to the Supabase `zzer-track-ingest` Edge Function. It sends the body as
`{ zzer_payload, captured_at }`. The extension does not read `.env.local` or any
other project environment file.

## Configure Supabase

1. Load the `extension` directory as an unpacked extension from `chrome://extensions`.
2. Open the extension service worker's developer tools.
3. In its Console, set the Supabase project URL and its public anon/publishable key:

   ```js
   chrome.storage.local.set({
     supabaseProjectUrl: "https://<project-ref>.supabase.co",
     supabaseAnonKey: "<public-anon-or-publishable-key>"
   });
   ```

   Use only the public anon/publishable key, never a service-role key. The URL
   must be the HTTPS URL of a Supabase project. Do not paste key values into
   source files, screenshots, or logs.

The settings are stored in this browser profile's extension storage. If either
setting is absent or invalid, the extension will not forward the request and
will log a configuration message without printing any key or request body.

## Verify the connector

With the extension configured, visit a page that causes Zzer to make the track
POST above. In the service worker developer tools' Network panel, verify one
POST to `/functions/v1/zzer-track-ingest` with a JSON body containing
`zzer_payload` and `captured_at`, and verify its response. Confirm the Edge
Function is deployed and accepts the project's public key before testing.

To check missing-configuration behavior, remove the settings in the service
worker Console with
`chrome.storage.local.remove(["supabaseProjectUrl", "supabaseAnonKey"])` and
trigger a track POST. No Supabase request should be made.
