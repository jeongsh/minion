/**
 * 대회 로고 마크. 단색 svg를 mask + currentColor로 그려서, 로고 파일의 fill 색과 무관하게
 * 부모의 텍스트 색을 따라간다(활성 잉크 칩 위에서는 흰색, 비활성에서는 회색, 다크모드 자동
 * 대응). 롤 이스포츠 내비의 모노크롬 리그 로고와 같은 처리.
 */
export function TournamentMark({ logo, className = "h-5 w-7" }: { logo: string; className?: string }) {
  const maskStyle: React.CSSProperties = {
    maskImage: `url(${logo})`,
    WebkitMaskImage: `url(${logo})`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };

  return <span aria-hidden="true" className={`shrink-0 bg-current ${className}`} style={maskStyle} />;
}
