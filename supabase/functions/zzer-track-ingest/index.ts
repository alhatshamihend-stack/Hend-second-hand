import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const ZzerTrackPayloadSchema = z.object({
  zzer_payload: z.unknown().optional(),
  timestamp: z.number().optional(),
});

const ZzerProductSchema = z.object({
  zzer_item_id: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().nullable().optional(),
  condition_grade: z.enum(["S", "A", "B", "C", "D"]).optional(),
  selling_price_cny: z.number().nullable().optional(),
  auth_certificate_url: z.string().nullable().optional(),
  photos: z.array(z.string()).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

const SUPABASE_URL = Deno.env.get("HENDSUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("HENDSUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const normalizeItemId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
};

const normalizePhotos = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const url = record.url ?? record.src ?? record.image ?? record.photo;
        return typeof url === "string" ? url : null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
};

const normalizeCondition = (value: unknown): "S" | "A" | "B" | "C" | "D" | undefined => {
  const normalized = typeof value === "string" ? value.toUpperCase() : value;
  if (normalized === "S" || normalized === "A" || normalized === "B" || normalized === "C" || normalized === "D") {
    return normalized;
  }
  return undefined;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizePayloadToZzerRow = (raw: unknown) => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid payload");
  }

  const record = raw as Record<string, unknown>;
  const itemId = normalizeItemId(record.itemId ?? record.id ?? record.zzer_item_id ?? record.product_id ?? record.uuid);
  const title = typeof record.title === "string" ? record.title : typeof record.name === "string" ? record.name : "Untitled";
  const brand = typeof record.brand === "string" ? record.brand : typeof record.vendor === "string" ? record.vendor : null;
  const sellingPrice = toNumber(record.selling_price_cny ?? record.price_cny ?? record.price ?? record.sale_price);
  const condition = normalizeCondition(record.condition_grade ?? record.grade ?? record.condition);
  const certificate = typeof record.auth_certificate_url === "string" ? record.auth_certificate_url : typeof record.certificate_url === "string" ? record.certificate_url : null;
  const photos = normalizePhotos(record.photos ?? record.images ?? record.image_urls ?? record.media);

  if (!itemId || !title) {
    throw new Error("Missing required zzer_item_id or title");
  }

  return {
    zzer_item_id: itemId,
    title,
    brand,
    condition_grade: condition,
    selling_price_cny: sellingPrice,
    auth_certificate_url: certificate,
    photos,
    updated_at: new Date().toISOString(),
  };
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const parsed = ZzerTrackPayloadSchema.parse(body);
    const zzerPayload = parsed.zzer_payload ?? body;
    const normalized = normalizePayloadToZzerRow(zzerPayload);
    const validated = ZzerProductSchema.parse({
      ...normalized,
      created_at: new Date().toISOString(),
    });

    const { data, error } = await supabase.from("products_zzer").upsert(validated, {
      onConflict: "zzer_item_id",
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
