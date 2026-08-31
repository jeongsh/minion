import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMinionTheme } from '@/hooks/use-minion-theme';
import { resolveApiAssetUrl } from '@/lib/api-client';
import { MinionBrandLogo } from '@/components/minion-brand-logo';

const FOOTER_LINKS = [
  { label: '서비스 소개', path: '/about' },
  { label: '이용약관', path: '/terms' },
  { label: '개인정보처리방침', path: '/privacy' },
  { label: '커뮤니티 운영원칙', path: '/community/rules' },
  { label: '광고·제휴 문의', path: '/advertising' },
  // 고객센터는 웹처럼 문의 내역을 앱 안에서 바로 보여줘야 해서, 나머지 정책 링크와
  // 달리 외부 브라우저 대신 네이티브 화면(/support)으로 이동한다.
  { label: '고객센터', path: '/support', internal: true },
];

export function MinionFooter({ accentColor }: { accentColor?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fonts, theme } = useMinionTheme();
  const openWebPage = (path: string) => void Linking.openURL(resolveApiAssetUrl(path) ?? path);

  return (
    <View style={[styles.footer, { paddingBottom: theme.size.footerDockClearance + insets.bottom }]}>
      <View style={styles.footerTop}>
        <MinionBrandLogo color={accentColor} />
        <View style={styles.footerNav}>
          {FOOTER_LINKS.map((link) => (
            <Pressable key={link.path} onPress={() => link.internal ? router.push(link.path as never) : openWebPage(link.path)}>
              <Text style={[styles.footerLink, { color: theme.footerNav, ...fonts.bold }]}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text style={[styles.footerDisclaimer, { color: theme.footerText, ...fonts.regular }]}>
        {"MINION isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc."}
      </Text>
      <Text style={[styles.footerCredit, { color: theme.footerText, ...fonts.regular }]}>
        Data adapted from{' '}
        <Text onPress={() => void Linking.openURL('https://lol.fandom.com/wiki/League_of_Legends_Esports_Wiki')} style={styles.footerInlineLink}>
          Leaguepedia
        </Text>
        {' '}under{' '}
        <Text onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by-sa/3.0/')} style={styles.footerInlineLink}>
          CC BY-SA 3.0
        </Text>
        .
      </Text>
      <Text style={[styles.footerCopyright, { color: theme.footerText, ...fonts.regular }]}>© 2026 MINION. All rights reserved.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingTop: 40 },
  footerCopyright: { fontSize: 13, lineHeight: 19.5, marginTop: 12 },
  footerCredit: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  footerDisclaimer: { fontSize: 13, lineHeight: 20, marginTop: 8 },
  footerInlineLink: { textDecorationLine: 'underline' },
  footerLink: { fontSize: 13, lineHeight: 19.5 },
  footerNav: { columnGap: 16, flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, width: '100%' },
  footerTop: { alignItems: 'flex-start', rowGap: 8 },
});
