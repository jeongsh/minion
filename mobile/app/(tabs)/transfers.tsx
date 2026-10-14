import { useLocalSearchParams } from 'expo-router';

import { TransferMarketScreen } from '@/components/transfers/transfer-market';

export default function TransfersRoute() {
  const { season } = useLocalSearchParams<{ season?: string }>();
  return <TransferMarketScreen season={season} />;
}
