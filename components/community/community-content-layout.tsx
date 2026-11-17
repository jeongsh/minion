import type { ReactNode } from "react";

import { AdSlot } from "@/components/ui/ad-slot";
import { CommunityNotificationRail } from "@/components/community/community-notification-rail";

export function CommunityContentLayout({ children, currentPostId, adsEnabled = false }: { children: ReactNode; currentPostId?: string; adsEnabled?: boolean }) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start xl:gap-6">
      <div className="min-w-0">
        <AdSlot enabled={adsEnabled} placement="community" format="horizontal" className="community-mobile-ad h-[60px] w-full !rounded-none md:mb-4 xl:hidden" />
        {children}
        {currentPostId ? <AdSlot enabled={adsEnabled} placement="horizontal" className="mt-6 h-[60px] xl:h-[90px]" /> : null}
      </div>
      <aside className="hidden w-full max-w-[300px] flex-col gap-4 xl:sticky xl:top-[88px] xl:flex" aria-label="커뮤니티 보조 정보">
        <CommunityNotificationRail />
        {!currentPostId ? <AdSlot enabled={adsEnabled} placement="community" format="rectangle" className="h-[250px] w-full max-w-[300px]" /> : null}
      </aside>
    </div>
  );
}
