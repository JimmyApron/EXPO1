import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

type BrandIconProps = {
  size?: number;
};

export function BrandIcon({ size = 48 }: BrandIconProps) {
  return (
    <Image
      accessibilityLabel="Watt 전구 아이콘"
      source={require('@/assets/images/watt-icon.png')}
      style={[styles.icon, { width: size, height: size, borderRadius: size * 0.22 }]}
      contentFit="cover"
      transition={160}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    overflow: 'hidden',
  },
});
