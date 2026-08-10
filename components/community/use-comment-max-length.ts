"use client";

import { useEffect, useState } from "react";

import {
  COMMENT_DESKTOP_MAX_LENGTH,
  COMMENT_MOBILE_MAX_LENGTH,
  isMobileCommentClient,
} from "@/lib/community/limits";

export function useCommentMaxLength(): number {
  const [maxLength, setMaxLength] = useState(COMMENT_DESKTOP_MAX_LENGTH);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const syncLimit = () => {
      setMaxLength(
        mobileQuery.matches || isMobileCommentClient(navigator.userAgent)
          ? COMMENT_MOBILE_MAX_LENGTH
          : COMMENT_DESKTOP_MAX_LENGTH,
      );
    };
    syncLimit();
    mobileQuery.addEventListener("change", syncLimit);
    return () => mobileQuery.removeEventListener("change", syncLimit);
  }, []);

  return maxLength;
}
