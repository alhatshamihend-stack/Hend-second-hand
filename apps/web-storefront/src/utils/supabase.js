export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key';

export const getProductsQuery = () => {
  const params = new URLSearchParams({
    select: '*',
    order: 'updated_at.desc',
    limit: '10',
  });

  return `${SUPABASE_URL}/rest/v1/products_zzer?${params.toString()}`;
};

export const getProductQuery = (id) => {
  const params = new URLSearchParams({
    select: '*',
    zzer_item_id: `eq.${id}`,
  });

  return `${SUPABASE_URL}/rest/v1/products_zzer?${params.toString()}`;
};
