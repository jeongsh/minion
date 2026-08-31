import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outputDirectory = path.join(process.cwd(), "public", "minicons", "minion-starter");

const items = [
  { file: "01-good.png", label: "좋아", accent: "#03DE8A", ink: "#071A11", symbol: "✓" },
  { file: "02-go.png", label: "가자", accent: "#D8F45B", ink: "#17200A", symbol: "→" },
  { file: "03-agree.png", label: "인정", accent: "#BDE8FF", ink: "#10253A", symbol: "OK" },
  { file: "04-wow.png", label: "대박", accent: "#FFD064", ink: "#352306", symbol: "!" },
  { file: "05-close.png", label: "아쉽", accent: "#DAD7FF", ink: "#242044", symbol: "…" },
  { file: "06-good-game.png", label: "수고", accent: "#FFC7AF", ink: "#3A1B10", symbol: "GG" },
  { file: "07-lol.png", label: "ㅋㅋ", accent: "#FFB9D2", ink: "#3B1524", symbol: ":D" },
  { file: "08-focus.png", label: "집중", accent: "#BDEEDB", ink: "#102B21", symbol: "◎" },
  { file: "09-win.png", label: "승리", accent: "#03DE8A", ink: "#071A11", symbol: "W" },
  { file: "10-fighting.png", label: "파이팅", accent: "#D8F45B", ink: "#17200A", symbol: "+" },
];

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

await mkdir(outputDirectory, { recursive: true });

for (const item of items) {
  const labelSize = item.label.length >= 3 ? 42 : 50;
  const svg = `
    <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="184" height="184" rx="44" fill="${item.accent}"/>
      <rect x="8.75" y="8.75" width="182.5" height="182.5" rx="43.25" fill="none" stroke="${item.ink}" stroke-opacity=".16" stroke-width="1.5"/>
      <text x="24" y="38" fill="${item.ink}" fill-opacity=".68" font-family="Pretendard, Noto Sans KR, Arial, sans-serif" font-size="13" font-weight="500" letter-spacing="1.2">MINION</text>
      <circle cx="164" cy="33" r="8" fill="${item.ink}" fill-opacity=".12"/>
      <text x="100" y="119" text-anchor="middle" fill="${item.ink}" font-family="Pretendard, Noto Sans KR, Arial, sans-serif" font-size="${labelSize}" font-weight="800" letter-spacing="-2">${escapeXml(item.label)}</text>
      <rect x="72" y="143" width="56" height="30" rx="15" fill="${item.ink}"/>
      <text x="100" y="164" text-anchor="middle" fill="${item.accent}" font-family="Pretendard, Noto Sans KR, Arial, sans-serif" font-size="16" font-weight="700">${escapeXml(item.symbol)}</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(outputDirectory, item.file));
}

console.log(`Generated ${items.length} starter minicons in ${outputDirectory}`);
