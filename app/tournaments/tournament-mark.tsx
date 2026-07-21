/**
 * 대회 로고 마크. 단색 svg를 mask + currentColor로 그려서, 로고 파일의 fill 색과 무관하게
 * 부모의 텍스트 색을 따라간다(활성 잉크 칩 위에서는 흰색, 비활성에서는 회색, 다크모드 자동
 * 대응). 롤 이스포츠 내비의 모노크롬 리그 로고와 같은 처리.
 *
 * 로고마다 비율이 크게 달라서(EWC/ENC 워드마크는 4~5:1, MSI/월즈는 정사각) 높이만 맞추면
 * 워드마크가 엠블럼보다 4~5배 넓어져 줄에서 혼자 튄다. 반대로 폭만 맞추면 워드마크가
 * 뭉개진다. 그래서 높이(className의 h-*)와 최대 폭(max-w-*)을 둘 다 주고, 그 안에서
 * contain으로 맞춘다. 세로로 긴 엠블럼은 높이에, 가로로 긴 워드마크는 최대 폭에 걸려서
 * 자동으로 비슷한 시각적 크기가 된다.
 */
export function TournamentMark({
  logo,
  aspect = 1.4,
  className = "h-5 max-w-[44px]",
}: {
  logo: string;
  aspect?: number;
  className?: string;
}) {
  const maskStyle: React.CSSProperties = {
    aspectRatio: `${aspect}`,
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
