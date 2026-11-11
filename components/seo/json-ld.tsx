/** schema.org 구조화 데이터를 문서에 싣는다. 본문 문자열이 script를 닫지 못하게 `<`를 이스케이프한다. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
