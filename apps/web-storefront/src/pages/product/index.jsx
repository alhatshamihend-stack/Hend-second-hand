import React, { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';

import { SUPABASE_ANON_KEY, getProductQuery } from '../../utils/supabase';

export default function ProductPage() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Taro.getCurrentInstance().router?.params?.id;

    const fetchProduct = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(getProductQuery(id), {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to load product');
        }

        const data = await res.json();
        setProduct(data[0] || null);
      } catch (error) {
        console.error('Error loading product', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, []);

  if (loading) {
    return <View className='page'>Loading...</View>;
  }

  if (!product) {
    return <View className='page'>Product not found.</View>;
  }

  const photos = Array.isArray(product.photos) ? product.photos : [];

  return (
    <View className='page product-page'>
      <View className='gallery'>
        {photos.length > 0 ? photos.map((photo, index) => (
          <Image key={`${product.zzer_item_id}-${index}`} src={photo} mode='aspectFill' className='hero-image' />
        )) : <Image src='https://via.placeholder.com/600x600' mode='aspectFill' className='hero-image' />}
      </View>

      <View className='content'>
        <Text className='grade'>Grade {product.condition_grade || 'B'}</Text>
        <Text className='title'>{product.title}</Text>
        <Text className='price'>¥{product.selling_price_cny || 0}</Text>
        {product.brand ? <Text className='meta'>Brand: {product.brand}</Text> : null}
      </View>
    </View>
  );
}

ProductPage.config = {
  navigationBarTitleText: 'Product Details',
};
