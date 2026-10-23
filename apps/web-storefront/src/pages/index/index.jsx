// apps/web-storefront/src/pages/index/index.jsx
import { View, Text, Image } from '@tarojs/components';
import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { supabase } from '../../utils/supabase.js';
import './index.css';

function safeParsePhotos(photosValue) {
  if (!photosValue) return [];

  let parsed = photosValue;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      const value = parsed.trim();
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return [value];
      }

      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(parsed)) {
    parsed = [parsed];
  }

  return parsed
    .map((photo) => {
      if (typeof photo === 'string') return photo;
      if (photo && typeof photo === 'object') {
        return photo.url || photo.src || photo.image_url || '';
      }
      return '';
    })
    .filter((photo) => typeof photo === 'string' && photo.length > 0);
}

export default function Index() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const placeholderImage = 'https://via.placeholder.com/300x300?text=No+Image';

  useEffect(() => {
    let isMounted = true;

    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products_zzer')
          .select('id, zzer_item_id, title, brand, category, condition_grade, selling_price_cny, photos, updated_at, auth_certificate_url')
          .order('updated_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        if (isMounted) setProducts(data || []);
      } catch (err) {
        console.error('[Index] Failed to fetch ZZER products:', err);
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <View className='loading'>Laddar Hend second hand-produkter...</View>;
  }

  return (
    <View className='container'>
      <Text className='title'>Senaste produkterna</Text>

      {products.length === 0 ? (
        <View className='empty'>
          <Text>Inga produkter kunde hämtas just nu.</Text>
        </View>
      ) : (
        <View className='product-list'>
          {products.map((product) => {
            const photos = safeParsePhotos(product.photos);
            const firstPhoto = photos[0] || placeholderImage;

            return (
              <View
                key={product.zzer_item_id || product.id}
                className='product-card'
                onClick={() => {
                  const productIdentifier = product.zzer_item_id || product.id;
                  Taro.navigateTo({
                    url: '/pages/product/index?id=' + encodeURIComponent(productIdentifier),
                  });
                }}
              >
                <Image
                  src={firstPhoto}
                  mode='aspectFill'
                  className='product-image'
                />

                <View className='product-info'>
                  <Text className='product-title'>{product.title || 'Produkt'}</Text>
                  {product.brand ? <Text>{product.brand}</Text> : null}
                  <View className='product-meta'>
                    <Text className='condition-grade'>{product.condition_grade || 'N/A'}</Text>
                    <Text className='price'>¥{product.selling_price_cny ?? '—'}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
