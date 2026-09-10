import Bell from 'lucide-react-native/icons/bell';
import Camera from 'lucide-react-native/icons/camera';
import Radio from 'lucide-react-native/icons/radio';
import Video from 'lucide-react-native/icons/video';
import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { useMinionTheme } from '@/hooks/use-minion-theme';
import type { MobileTeamNotificationSelection } from '@/lib/api-client';

const EMPTY_SELECTION: MobileTeamNotificationSelection = {
  matchAlertsEnabled: false,
  liveMatchAlertsEnabled: false,
  instagramAlertsEnabled: false,
  videoAlertsEnabled: false,
};

const OPTIONS: {
  description: string;
  icon: LucideIcon;
  key: keyof MobileTeamNotificationSelection;
  title: string;
}[] = [
  { key: 'matchAlertsEnabled', title: '경기', description: '응원팀 경기 시작과 세트 평가', icon: Bell },
  { key: 'liveMatchAlertsEnabled', title: '라이브 경기', description: '킬과 주요 오브젝트 실시간 소식', icon: Radio },
  { key: 'instagramAlertsEnabled', title: 'Instagram', description: '팀과 선수의 새 게시물', icon: Camera },
  { key: 'videoAlertsEnabled', title: '동영상', description: '팀과 선수의 새 YouTube 영상', icon: Video },
];

export function FanNotificationPreferenceSheet({
  canConfigure,
  onClose,
  onLogin,
  onSave,
  open,
  teamColor,
  teamName,
}: {
  canConfigure: boolean;
  onClose: () => void;
  onLogin: () => void;
  onSave: (selection: MobileTeamNotificationSelection) => Promise<void>;
  open: boolean;
  teamColor: string;
  teamName: string;
}) {
  const { fonts, theme } = useMinionTheme();
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<MobileTeamNotificationSelection>(EMPTY_SELECTION);
  const anySelected = Object.values(selection).some(Boolean);

  const save = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onSave(selection);
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet
      contentStyle={styles.content}
      dismissible={!pending}
      maxHeight="92%"
      onClose={onClose}
      open={open}
      title={`${teamName} 알림 설정`}
      titleStyle={{ ...fonts.black, fontSize: 18, lineHeight: 28 }}
    >
      {canConfigure ? (
        <>
          <Text style={[styles.description, { color: theme.muted, ...fonts.regular }]}>받고 싶은 소식만 골라주세요. 선택하지 않아도 팔로우는 유지됩니다.</Text>
          <View accessibilityLabel={`${teamName} 알림 종류`} style={styles.options}>
            {OPTIONS.map((option) => {
              const checked = selection[option.key];
              const Icon = option.icon;
              return (
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked }}
                  disabled={pending}
                  key={option.key}
                  onPress={() => setSelection((current) => ({ ...current, [option.key]: !current[option.key] }))}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: checked ? `${teamColor}14` : theme.surface,
                      borderColor: checked ? teamColor : theme.border,
                      opacity: pressed ? 0.82 : 1,
                    },
                  ]}
                >
                  <View style={[styles.icon, { backgroundColor: theme.surfaceMuted }]}><Icon color={checked ? teamColor : theme.muted} size={19} /></View>
                  <View style={styles.copy}>
                    <Text style={[styles.optionTitle, { color: theme.ink, ...fonts.bold }]}>{option.title}</Text>
                    <Text style={[styles.optionDescription, { color: theme.muted, ...fonts.regular }]}>{option.description}</Text>
                  </View>
                  <View style={[styles.switchTrack, { backgroundColor: checked ? teamColor : theme.border }]}><View style={[styles.switchKnob, { transform: [{ translateX: checked ? 20 : 0 }] }]} /></View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <Pressable disabled={pending} onPress={onClose} style={[styles.secondary, { borderColor: theme.border }]}><Text style={[styles.buttonText, { color: theme.muted, ...fonts.medium }]}>나중에</Text></Pressable>
            <Pressable disabled={pending} onPress={() => void save()} style={[styles.primary, { backgroundColor: teamColor, opacity: pending ? 0.55 : 1 }]}>
              {pending ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={[styles.buttonText, { color: '#ffffff', ...fonts.medium }]}>{anySelected ? '선택 완료' : '알림 없이 팔로우'}</Text>}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.description, { color: theme.muted, ...fonts.regular }]}>로그인하면 경기, Instagram, 동영상 등 받고 싶은 팀 소식만 선택할 수 있어요.</Text>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={[styles.secondary, { borderColor: theme.border }]}><Text style={[styles.buttonText, { color: theme.muted, ...fonts.medium }]}>나중에</Text></Pressable>
            <Pressable onPress={onLogin} style={[styles.primary, { backgroundColor: teamColor }]}><Text style={[styles.buttonText, { color: '#ffffff', ...fonts.medium }]}>로그인하고 설정</Text></Pressable>
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 2, paddingTop: 4 },
  description: { fontSize: 16, lineHeight: 24 },
  options: { gap: 8, marginTop: 16 },
  option: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 68, paddingHorizontal: 12 },
  icon: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  copy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 15, lineHeight: 22 },
  optionDescription: { fontSize: 13, lineHeight: 18 },
  switchTrack: { borderRadius: 12, height: 24, padding: 2, width: 44 },
  switchKnob: { backgroundColor: '#ffffff', borderRadius: 10, height: 20, shadowColor: '#000000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.15, shadowRadius: 2, width: 20 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 20 },
  secondary: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flex: 1, height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  primary: { alignItems: 'center', borderRadius: 12, flex: 1.4, height: 44, justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { fontSize: 14, lineHeight: 20 },
});
