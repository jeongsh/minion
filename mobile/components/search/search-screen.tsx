import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Crown from 'lucide-react-native/icons/crown';
import Search from 'lucide-react-native/icons/search';
import Swords from 'lucide-react-native/icons/swords';
import UserRound from 'lucide-react-native/icons/user-round';
import X from 'lucide-react-native/icons/x';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { KeyboardAwareView } from '@/components/keyboard-aware-view';
import { MinionScreen } from '@/components/minion-screen';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import { fetchMobileQuery, resolveApiAssetUrl, type MobileSearchDto, type MobileSearchResult } from '@/lib/api-client';

const MIN_SEARCH_LENGTH = 2;
const TYPE_ICON = { team: null, player: UserRound, champion: Crown, match: CalendarDays, tournament: Swords };

function destination(href: string): Href {
  const segment = href.match(/^\/tournaments\/([^/?#]+)$/)?.[1];
  return (segment ? `/tournaments?segment=${segment}` : href) as Href;
}

export function SearchScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { colorScheme, fonts, theme } = useMinionTheme();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MobileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      const path = `/api/mobile/v1/search?q=${encodeURIComponent(term)}`;
      try {
        const data = await fetchMobileQuery<MobileSearchDto>(path, path, 'memory', false, {
          cancelOnUnused: true,
          signal: controller.signal,
          staleTimeMs: 30_000,
        });
        if (!active) return;
        setResults(data.results);
        setActiveIndex(data.results.length > 0 ? 0 : -1);
      } catch (error) {
        if (active && (error as Error).name !== 'AbortError') {
          setResults([]);
          setActiveIndex(-1);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const changeQuery = (next: string) => {
    setQuery(next);
    if (next.trim().length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setLoading(false);
      setActiveIndex(-1);
    } else setLoading(true);
    setOpen(true);
  };

  const go = (result: MobileSearchResult) => {
    setOpen(false);
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    setLoading(false);
    inputRef.current?.blur();
    Keyboard.dismiss();
    router.push(destination(result.href));
  };

  const dark = colorScheme === 'dark';
  const showPanel = open && query.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <KeyboardAwareView style={styles.root}>
      <MinionScreen>
        <View style={styles.search}>
          <View style={[styles.field, { backgroundColor: dark ? '#282c31' : '#f2f3f5' }]}>
            {loading ? <ActivityIndicator color="#777b82" size={18} /> : <Search color="#777b82" size={18} />}
            <TextInput
              accessibilityLabel="팀, 선수, 챔피언, 대회 검색"
              accessibilityRole="combobox"
              accessibilityState={{ expanded: showPanel }}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={changeQuery}
              onFocus={() => setOpen(true)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'ArrowDown' || nativeEvent.key === 'ArrowUp') {
                  const delta = nativeEvent.key === 'ArrowDown' ? 1 : -1;
                  setOpen(true);
                  setActiveIndex((index) => results.length ? (index + delta + results.length) % results.length : -1);
                } else if (nativeEvent.key === 'Escape') {
                  setOpen(false);
                  Keyboard.dismiss();
                }
              }}
              onSubmitEditing={() => { const target = results[activeIndex] ?? results[0]; if (target) go(target); }}
              placeholder="팀, 선수, 챔피언, 대회 검색"
              placeholderTextColor="#777b82"
              ref={inputRef}
              returnKeyType="search"
              style={[styles.input, { color: theme.ink, ...fonts.regular }]}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable accessibilityLabel="검색어 지우기" accessibilityRole="button" onPress={() => { changeQuery(''); inputRef.current?.focus(); }} style={styles.clear}>
                <X color="#777b82" size={15} />
              </Pressable>
            ) : null}
          </View>

          {showPanel ? (
            <View accessibilityLabel="검색 결과" accessibilityRole="list" style={[styles.panel, { backgroundColor: theme.pageBackground, borderColor: dark ? theme.border : '#e8e8eb' }]}>
              {results.length > 0 ? (
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.7 }}>
                  {results.map((result, index) => {
                    const Icon = TYPE_ICON[result.type];
                    const uri = resolveApiAssetUrl(result.image?.url);
                    return (
                      <Pressable
                        accessibilityLabel={`${result.title}, ${result.subtitle}`}
                        accessibilityState={{ selected: index === activeIndex }}
                        role="option"
                        key={`${result.type}-${result.href}`}
                        onHoverIn={() => setActiveIndex(index)}
                        onPress={() => go(result)}
                        style={[styles.result, { backgroundColor: index === activeIndex ? dark ? '#282c31' : '#f4f4f5' : 'transparent' }]}>
                        <View style={[styles.resultImage, { backgroundColor: dark ? '#30343b' : '#f2f3f5' }]}>
                          {uri ? <Image contentFit="contain" source={{ uri }} style={styles.image} tintColor={result.type === 'tournament' && dark ? '#ffffff' : undefined} />
                            : Icon ? <Icon color={theme.muted} size={18} />
                              : <Text style={{ color: theme.muted, ...fonts.medium, fontSize: 13 }}>{result.title.slice(0, 2)}</Text>}
                        </View>
                        <View style={styles.resultCopy}>
                          <Text numberOfLines={1} style={[styles.resultTitle, { color: theme.ink, ...fonts.bold }]}>{result.title}</Text>
                          <Text numberOfLines={1} style={[styles.resultSubtitle, { color: theme.muted, ...fonts.medium }]}>{result.subtitle}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : loading ? (
                <Text style={[styles.loading, { color: theme.muted, ...fonts.medium }]}>검색 중…</Text>
              ) : (
                <View style={styles.emptyPadding}>
                  <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
                    <Image contentFit="contain" source={require('@/assets/characters/pen-4.png')} style={styles.emptyImage} />
                    <Text style={[styles.emptyTitle, { color: theme.ink, ...fonts.bold }]}>앗, 이 조합은 못 찾았어요</Text>
                    <Text style={[styles.emptyBody, { color: theme.muted, ...fonts.regular }]}>{`'${query.trim()}' 말고 다른 이름으로 다시 콕 찍어볼까요?`}</Text>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </View>
      </MinionScreen>
    </KeyboardAwareView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { gap: 8 },
  field: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, height: 40, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 14, height: 40, lineHeight: 20, minWidth: 0, padding: 0, outlineStyle: 'solid', outlineWidth: 0 },
  clear: { alignItems: 'center', borderRadius: 12, height: 24, justifyContent: 'center', width: 24 },
  panel: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  result: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  resultImage: { alignItems: 'center', borderRadius: 8, height: 36, justifyContent: 'center', overflow: 'hidden', width: 36 },
  image: { height: 32, width: 32 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: 15, lineHeight: 20 },
  resultSubtitle: { fontSize: 13, lineHeight: 18 },
  loading: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingVertical: 24, textAlign: 'center' },
  emptyPadding: { padding: 12 },
  empty: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, minHeight: 112, paddingHorizontal: 20, paddingVertical: 20 },
  emptyImage: { height: 56, width: 56 },
  emptyTitle: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  emptyBody: { fontSize: 16, lineHeight: 24, marginTop: 6, textAlign: 'center' },
});
