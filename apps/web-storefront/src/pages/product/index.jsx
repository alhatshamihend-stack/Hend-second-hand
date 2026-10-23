import { View, Text, Image, Swiper, SwiperItem } from '@tarojs/components';
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

export default function ProductDetail() {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const params = Taro.getCurrentInstance().router?.params || {};
  const productId = params.id;
  const placeholderImage = 'https://via.placeholder.com/600x600?text=No+Image';

  useEffect(() => {
    let isMounted = true;

    async function fetchProduct() {
      if (!productId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products_zzer')
          .select('id, zzer_item_id, title, brand, category, condition_grade, selling_price_cny, photos, updated_at, auth_certificate_url')
          .eq('zzer_item_id', productId)
          .single();

        if (error) throw error;
        if (isMounted) setProduct(data);
      } catch (err) {
        console.error('Failed to fetch ZZER product:', err);
        if (isMounted) setProduct(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (loading) return <View className='loading'>Laddar produkt...</View>;
  if (!product) return <View className='empty'>Produkten hittades inte</View>;

  const photos = safeParsePhotos(product.photos);
  const galleryPhotos = photos.length > 0 ? photos : [placeholderImage];

  return (
    <View className='product-detail'>
      <Swiper className='swiper' indicatorDots autoplay circular>
        {galleryPhotos.map((photo, idx) => (
          <SwiperItem key={idx}>
            <Image src={photo} mode='aspectFill' className='swiper-image' />
          </SwiperItem>
        ))}
      </Swiper>

      <View className='info-section'>
        <Text className='title'>{product.title}</Text>

        <View className='meta-row'>
          <View className={'badge grade-' + (product.condition_grade || 'B').toLowerCase()}>
            Skick: {product.condition_grade || 'N/A'}
          </View>
          <Text className='price'>¥{product.selling_price_cny ?? '—'}</Text>
        </View>

        {product.brand ? (
          <View className='detail-item'>
            <Text className='label'>Varumärke:</Text>
            <Text className='value'>{product.brand}</Text>
          </View>
        ) : null}

        {product.category ? (
          <View className='detail-item'>
            <Text className='label'>Kategori:</Text>
            <Text className='value'>{product.category}</Text>
          </View>
        ) : null}

        {product.auth_certificate_url ? (
          <View className='detail-item auth'>
            <Text className='label'>Autentisering:</Text>
            <Text className='value verified'>✓ Verifierad</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
