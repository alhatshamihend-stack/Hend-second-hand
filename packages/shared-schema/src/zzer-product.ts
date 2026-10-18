import { z } from "zod";

export const ZzerImageSchema = z.object({
  id: z.string().optional(),
  url: z.string().url().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  position: z.number().optional(),
});

export const ZzerOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  values: z.array(z.string()).optional(),
});

export const ZzerVariantSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  sku: z.string().nullable().optional(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  compare_at_price: z.union([z.string(), z.number()]).nullable().optional(),
  available: z.boolean().optional(),
  inventory_quantity: z.number().nullable().optional(),
  option1: z.string().nullable().optional(),
  option2: z.string().nullable().optional(),
  option3: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export const ZzerProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  body_html: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  product_type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  images: z.array(ZzerImageSchema).default([]),
  variants: z.array(ZzerVariantSchema).default([]),
  options: z.array(ZzerOptionSchema).default([]),
  source: z.literal("zzer").optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ZzerImage = z.infer<typeof ZzerImageSchema>;
export type ZzerOption = z.infer<typeof ZzerOptionSchema>;
export type ZzerVariant = z.infer<typeof ZzerVariantSchema>;
export type ZzerProduct = z.infer<typeof ZzerProductSchema>;

export const emptyZzerProduct = (): ZzerProduct => ({
  id: "",
  title: "",
  handle: "",
  images: [],
  variants: [],
  tags: [],
  options: [],
  source: "zzer",
});
