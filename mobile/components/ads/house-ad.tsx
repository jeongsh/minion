import { usePathname, useRouter } from 'expo-router';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import MessagesSquare from 'lucide-react-native/icons/messages-square';
import Sticker from 'lucide-react-native/icons/sticker';
import Trophy from 'lucide-react-native/icons/trophy';
import type { LucideIcon } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMinionTheme } from '@/hooks/use-minion-theme';

type HousePromo = { href: string; title: string; description: string; icon: LucideIcon; android?: boolean };

// Internal promotions shown when an ad placement has no fill.
const PROMOS: HousePromo[] = [
  { href: '/community', title: '팬톡', description: '오늘 경기 이야기를 나눠보세요.', icon: MessagesSquare },
  { href: '/predictions', title: '승부예측', description: '다음 경기 승리팀을 맞혀보세요.', icon: Trophy, android: true },
  { href: '/transfers', title: '이적시장', description: '선수 이적 소식을 한눈에 확인하세요.', icon: ArrowLeftRight },
  { href: '/minicons', title: '미니콘', description: '댓글에 쓸 미니콘을 모아보세요.', icon: Sticker },
];

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
}

export function HouseAd({ placement, height }: { placement: string; height: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { fonts, theme } = useMinionTheme();
  const candidates = PROMOS.filter(promo => (!promo.android || Platform.OS === 'android') && !pathname.startsWith(promo.href));
  const promo = candidates[hash(placement) % candidates.length] ?? PROMOS[0];
  const Icon = promo.icon;
  return (
    <Pressable accessibilityLabel={`${promo.title}, ${promo.description}`} accessibilityRole="link" onPress={() => router.push(promo.href as never)} style={({ pressed }) => [styles.root, { backgroundColor: theme.surfaceMuted, height, opacity: pressed ? 0.78 : 1 }]}>
      <View style={[styles.icon, { backgroundColor: theme.surface }]}><Icon color={theme.accent} size={22} strokeWidth={1.8} /></View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={{ color: theme.ink, ...fonts.bold, fontSize: 15, lineHeight: 22 }}>{promo.title}</Text>
        <Text numberOfLines={1} style={{ color: theme.muted, ...fonts.regular, fontSize: 13, lineHeight: 19.5 }}>{promo.description}</Text>
      </View>
      <ChevronRight color={theme.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  icon: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, gap: 2, minWidth: 0 },
});
