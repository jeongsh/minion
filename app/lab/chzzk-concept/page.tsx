import type { Metadata } from "next";

import { ChzzkConcept } from "./chzzk-concept";

export const metadata: Metadata = {
  title: "CHZZK Concept Lab | MINION",
  robots: { index: false, follow: false },
};

export default function ChzzkConceptPage() {
  return <ChzzkConcept />;
}
