import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
import { useEffect, useState } from 'react';
import Taro from '@tarojs/taro';
import { supabase } from '../../utils/supabase.js';
import './index.css';

export default function ProductDetail() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = Taro.getCurrentInstance().router?.params || {};
  const productId = params.id;

  useEffect(() => {
    async function fetchProduct() {
      if (!productId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products_zzer')
          .select('*')
          .eq('id', productId)
          .single();

        if (error) throw error;
        setProduct(data);
      } catch (err) {
        console.error('Failed to fetch product:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [productId]);

  if (loading) return <View className='loading'>Laddar produkt...</View>;
  if (!product) return <View className='empty'>Produkten hittades inte</View>;

  const photos = product.photos || [];
  const mainImage = photos[0]?.url || '/placeholder.png';

  return (
    <View className='product-detail'>
      <Swiper className='swiper' indicatorDots autoplay circular>
        {photos.length > 0 ? (
          photos.map((photo, idx) => (
            <SwiperItem key={idx}>
              <Image src={photo.url} mode='aspectFill' className='swiper-image' />
            </SwiperItem>
          ))
        ) : (
          <SwiperItem>
            <Image src={mainImage} mode='aspectFill' className='swiper-image' />
          </SwiperItem>
        )}
      </Swiper>

      <View className='info-section'>
        <Text className='title'>{product.title}</Text>

        <View className='meta-row'>
          <View className={`badge grade-${(product.condition_grade || 'B').toLowerCase()}`}>
            Skick: {product.condition_grade || 'N/A'}
          </View>
          <Text className='price'>¥{product.selling_price_cny}</Text>
        </View>

        {product.brand && (
          <View className='detail-item'>
            <Text className='label'>Varumärke:</Text>
            <Text className='value'>{product.brand}</Text>
          </View>
        )}

        {product.auth_certificate_url && (
          <View className='detail-item auth'>
            <Text className='label'>Autentisering:</Text>
            <Text className='value verified'>✓ Verifierad</Text>
          </View>
        )}
      </View>
    </View>
  );
}
