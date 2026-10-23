import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { TournamentPendingContent } from "@/components/navigation/tournament-content-cache";

export default function Loading() {
  return (
    <>
      <TournamentPendingContent />
      <NavigationLoadingOverlay />
    </>
  );
}
