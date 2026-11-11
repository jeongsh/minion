// X 카드도 같은 매치 카드를 쓴다. 이 파일이 없으면 루트 레이아웃의 기본 이미지가 twitter:image로 내려간다.
import Image from "./opengraph-image";

export const alt = "MINION match card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 600;

export default Image;
