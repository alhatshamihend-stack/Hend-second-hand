import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, Navigator } from '@tarojs/components';

import { supabase } from '../../utils/supabase.js';

const FALLBACK_IMAGE = 'https://via.placeholder.com/600x600';

export default function IndexPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products_zzer')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          throw error;
        }

        if (isMounted) {
          setProducts(data ?? []);
        }
      } catch (error) {
        console.error('Error loading products', error);
        if (isMounted) {
          setProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return bTime - aTime;
    }),
    [products],
  );

  const renderProductCard = (product) => {
    const imageUrl = Array.isArray(product.photos) && product.photos.length > 0
      ? product.photos[0]
      : product.image_url || FALLBACK_IMAGE;

    const price = Number(product.selling_price_cny ?? 0) || 0;
    const condition = product.condition_grade || 'N/A';
    const productId = product.zzer_item_id || product.id;

    return (
      <Navigator
        key={productId}
        url={`/pages/product/index?id=${encodeURIComponent(productId)}`}
        style={{
          display: 'block',
          background: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          border: '1px solid #f0f0f0',
        }}
      >
        <Image
          src={imageUrl}
          mode='aspectFill'
          style={{
            width: '100%',
            height: '180px',
            backgroundColor: '#f5f5f5',
          }}
        />
        <View style={{ padding: '12px' }}>
          <Text style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
            Condition: {condition}
          </Text>
          <Text style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#111', marginBottom: '8px' }}>
            {product.title || 'Untitled product'}
          </Text>
          <Text style={{ display: 'block', fontSize: '18px', fontWeight: 700, color: '#1d4ed8' }}>
            ¥{price}
          </Text>
        </View>
      </Navigator>
    );
  };

  return (
    <View style={{ padding: '16px', background: '#f7f7f7', minHeight: '100vh' }}>
      <View style={{ marginBottom: '18px' }}>
        <Text style={{ fontSize: '24px', fontWeight: 700, color: '#111' }}>Zzer Storefront</Text>
      </View>

      {loading ? (
        <View style={{ padding: '32px 0', textAlign: 'center', color: '#666' }}>Loading products...</View>
      ) : sortedProducts.length === 0 ? (
        <View style={{ padding: '32px 0', textAlign: 'center', color: '#666' }}>No products available yet.</View>
      ) : (
        <View style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {sortedProducts.map(renderProductCard)}
        </View>
      )}
    </View>
  );
}

IndexPage.config = {
  navigationBarTitleText: 'Zzer Storefront',
};
