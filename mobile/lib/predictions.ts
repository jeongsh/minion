export function predictionMaxStake(balance: number) {
  return Math.min(5_000, Math.max(100, Math.floor((Math.max(0, balance) * 0.2) / 100) * 100));
}
