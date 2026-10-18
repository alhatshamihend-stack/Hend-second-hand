import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ZzerProduct } from "@sandougi/shared-schema";

const SUPABASE_URL = Deno.env.get("HENDSUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("HENDSUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const safeJson = async (request: Request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  const payload = await safeJson(request);

  if (!payload || typeof payload !== "object") {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const product = payload as Partial<ZzerProduct>;

  if (!product.id || !product.title || !product.handle) {
    return new Response(
      JSON.stringify({ error: "Missing required product fields: id, title, handle" }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { data, error } = await supabase.from("products_zzer").upsert(
    {
      id: String(product.id),
      title: product.title,
      handle: product.handle,
      body_html: product.body_html ?? null,
      vendor: product.vendor ?? null,
      product_type: product.product_type ?? null,
      status: product.status ?? "draft",
      tags: product.tags ?? [],
      images: product.images ?? [],
      variants: product.variants ?? [],
      options: product.options ?? [],
      source: product.source ?? "zzer",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message, details: error.details ?? null }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, data }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
