import { View, Text, Image } from '@tarojs/components';
import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase.js';
import './index.css';

export default function Index() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products_zzer')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        setProducts(data || []);
      } catch (err) {
        console.error('Failed to fetch products:', err);
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

  if (loading) return <View className='loading'>Laddar Zzer-produkter...</View>;

  return (
    <View className='container'>
      <Text className='title'>Senaste från Zzer</Text>
      {products.length === 0 ? (
        <View className='empty'>
          <Text>Inga produkter ännu. Besök Zzer för att trigga datainsamling!</Text>
        </View>
      ) : (
        <View className='product-list'>
          {products.map((product) => (
            <View key={product.id} className='product-card'>
              <Image
                src={product.photos?.[0]?.url || '/placeholder.png'}
                mode='aspectFill'
                className='product-image'
              />
              <View className='product-info'>
                <Text className='product-title'>{product.title}</Text>
                <View className='product-meta'>
                  <Text className='condition-grade'>{product.condition_grade}</Text>
                  <Text className='price'>¥{product.selling_price_cny}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
