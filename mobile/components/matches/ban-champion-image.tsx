import { Image, StyleSheet } from 'react-native';

export function BanChampionImage({ url }: { url: string }) {
  return <Image resizeMode="cover" source={{ uri: url }} style={styles.image} />;
}

const styles = StyleSheet.create({
  image: { filter: [{ grayscale: 1 }], height: '100%', opacity: 0.65, width: '100%' },
});
