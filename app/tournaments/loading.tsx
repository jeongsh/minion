import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { TournamentLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return (
    <>
      <TournamentLoadingSkeleton />
      <NavigationLoadingOverlay />
    </>
  );
}
