import React, { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image, Navigator } from '@tarojs/components';

import { SUPABASE_ANON_KEY, getProductsQuery } from '../../utils/supabase';

export default function IndexPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(getProductsQuery(), {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to load products');
        }

        const data = await res.json();
        setProducts(data || []);
      } catch (error) {
        console.error('Error loading products', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <View className='page'>
      <View className='header'>
        <Text className='title'>Zzer Storefront</Text>
      </View>

      {loading ? (
        <View className='empty'>Loading products...</View>
      ) : products.length === 0 ? (
        <View className='empty'>No products available yet.</View>
      ) : (
        <View className='grid'>
          {products.map((product) => {
            const imageUrl = Array.isArray(product.photos) && product.photos.length > 0
              ? product.photos[0]
              : 'https://via.placeholder.com/600x600';

            return (
              <Navigator
                key={product.zzer_item_id}
                url={`/pages/product/index?id=${encodeURIComponent(product.zzer_item_id)}`}
                className='card'
              >
                <Image className='image' src={imageUrl} mode='aspectFill' />
                <View className='body'>
                  <Text className='grade'>Grade {product.condition_grade || 'B'}</Text>
                  <Text className='name'>{product.title || 'Untitled product'}</Text>
                  <Text className='price'>¥{product.selling_price_cny || 0}</Text>
                </View>
              </Navigator>
            );
          })}
        </View>
      )}
    </View>
  );
}

IndexPage.config = {
  navigationBarTitleText: 'Zzer Storefront',
};
