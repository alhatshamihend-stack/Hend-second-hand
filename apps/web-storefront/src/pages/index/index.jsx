console.log('🔥 INDEX.JSX LADDAS! Filen exekveras!');
import { View, Text, Image } from '@tarojs/components';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase.js';
import './index.css';

function safeParsePhotos(photosValue) {
  // Säkerhetsfunktion: databasen returnerar ibland JSON-strängar, ibland arrays.
  // Vi normaliserar alltid till en array innan vi använder [0].
  if (!photosValue) return [];

  if (Array.isArray(photosValue)) return photosValue;

  if (typeof photosValue === 'string') {
    try {
      const parsed = JSON.parse(photosValue);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
      return [];
    } catch (error) {
      // Fallback för strängar som inte är ren JSON, t.ex. "[\"url\"]" eller "https://..."
      if (photosValue.includes('http')) {
        return [photosValue];
      }

      return photosValue
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

export default function Index() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const placeholderImage = 'https://via.placeholder.com/300x300?text=No+Image';

  useEffect(() => {
    console.log('[Index] useEffect: start fetchProducts');

    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products_zzer')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.error('[Index] fetch error:', error);
          setProducts([]);
          return;
        }

        console.log('[Index] fetch success, result count:', (data && data.length) || 0, data);
        setProducts(data || []);
      } catch (err) {
        console.error('[Index] exception during fetch:', err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();

    const subscription = supabase
      .channel('zzer-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products_zzer' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [payload.new, ...prev].slice(0, 10));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  console.log('[Index] render: products length =', products.length, 'loading =', loading);

  if (loading) {
    return <View className='loading'>Laddar Zzer-produkter...</View>;
  }

  return (
    <View className='container'>
      <Text className='title'>Senaste från Zzer</Text>

      {products.length === 0 ? (
        <View className='empty'>
          <Text>Inga produkter ännu. Besök Zzer för att trigga datainsamling!</Text>
        </View>
      ) : (
        <View className='product-list'>
          {products.map((product) => {
            const photos = safeParsePhotos(product.photos);
            const firstPhoto = photos[0] || placeholderImage;

            return (
              <View key={product.id} className='product-card'>
                <Image
                  src={firstPhoto}
                  mode='aspectFill'
                  className='product-image'
                  onError={(event) => {
                    const target = event.target;
                    if (target) {
                      target.src = placeholderImage;
                    }
                  }}
                />

                <View className='product-info'>
                  <Text className='product-title'>{product.title}</Text>
                  <View className='product-meta'>
                    <Text className='condition-grade'>{product.condition_grade}</Text>
                    <Text className='price'>¥{product.selling_price_cny}</Text>
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
