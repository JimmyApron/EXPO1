import { Image, StyleSheet, View } from 'react-native';

type BrandIconProps = {
  size?: number;
};

export function BrandIcon({ size = 40 }: BrandIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={require('@/assets/images/brand-icon.png')}
        style={[styles.image, { width: size, height: size, borderRadius: size * 0.22 }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    overflow: 'hidden',
  },
});
