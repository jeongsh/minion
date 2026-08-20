import { useRouter } from 'expo-router';

import { ErrorState } from '@/components/feedback-states';
import { MinionScreen } from '@/components/minion-screen';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <MinionScreen>
      <ErrorState onRetry={() => router.replace('/')} title="요청한 화면을 찾을 수 없습니다." />
    </MinionScreen>
  );
}
