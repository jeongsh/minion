import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";

export default function Loading() {
  return (
    <>
      <main className="min-h-[calc(100vh-72px)] bg-[#f7f8fb]" aria-hidden="true" />
      <NavigationLoadingOverlay />
    </>
  );
}
