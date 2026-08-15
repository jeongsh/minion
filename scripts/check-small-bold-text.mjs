import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const STYLE_EXTENSIONS = new Set([".css", ".less", ".sass", ".scss"]);
const HEAVY_CLASS = /^(?:[^\s]+:)*font-(?:semibold|bold|extrabold|black|\[(?:[6-9]\d{2})\])$/;
const HEAVY_CLASS_GLOBAL = /(?<![\w-])((?:[^\s"'`]+:)*)(font-(?:semibold|bold|extrabold|black|\[(?:[6-9]\d{2})\]))(?![\w-])/g;
const SMALL_CLASS = /^(?:[^\s]+:)*text-(?:xs|\[(\d+(?:\.\d+)?)px\])$/;
const STRING_LITERAL = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gs;
const fix = process.argv.includes("--fix");

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath));
    else files.push(entryPath);
  }

  return files;
}

function isSmallClass(token) {
  const match = token.match(SMALL_CLASS);
  if (!match) return false;
  return match[1] === undefined || Number(match[1]) <= 12;
}

function lineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function isHeavyStyleWeight(weight) {
  return weight === "bold" || weight === "bolder" || Number(weight) >= 600;
}

function updateClassStrings(source) {
  return source.replace(STRING_LITERAL, (literal) => {
    const tokens = literal.slice(1, -1).split(/\s+/);
    if (!tokens.some(isSmallClass) || !tokens.some((token) => HEAVY_CLASS.test(token))) return literal;
    return literal.replace(HEAVY_CLASS_GLOBAL, "$1font-medium");
  });
}

function updateInlineStyles(source) {
  return source.replace(/\{[^{}]{0,1200}\}/gs, (block) => {
    const size = block.match(/fontSize\s*:\s*(?:["'](\d+(?:\.\d+)?)px["']|(\d+(?:\.\d+)?))/);
    const weight = block.match(/fontWeight\s*:\s*(?:["'](bold|bolder|[6-9]\d{2})["']|(\d+))/);
    if (!size || !weight || Number(size[1] ?? size[2]) > 12) return block;
    if (weight[1] && !["bold", "bolder"].includes(weight[1]) && Number(weight[1]) < 600) return block;
    if (weight[2] && Number(weight[2]) < 600) return block;
    return block.replace(weight[0], "fontWeight: 500");
  });
}

function updateElementAttributes(source) {
  return source.replace(/<[^>]+>/gs, (tag) => {
    const size = tag.match(/fontSize=(?:\{(\d+(?:\.\d+)?)\}|["'](\d+(?:\.\d+)?)(?:px)?["'])/);
    const weight = tag.match(/fontWeight=(?:\{["']?([6-9]\d{2}|bold|bolder)["']?\}|["']([6-9]\d{2}|bold|bolder)["'])/);
    if (!size || !weight || Number(size[1] ?? size[2]) > 12) return tag;
    return tag.replace(weight[0], 'fontWeight="500"');
  });
}

function updateCss(source) {
  return source.replace(/([^{}]*)\{([^{}]*)\}/gs, (block, selector, declarations) => {
    const size = declarations.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
    const weight = declarations.match(/font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i);
    if (!size || !weight || Number(size[1]) > 12) return block;
    return `${selector}{${declarations.replace(weight[0], "font-weight: 500")}}`;
  });
}

function findViolations(source, extension) {
  const violations = [];
  const report = (index, kind) => violations.push({ index, kind });

  if (SOURCE_EXTENSIONS.has(extension)) {
    for (const match of source.matchAll(STRING_LITERAL)) {
      const tokens = match[0].slice(1, -1).split(/\s+/);
      if (tokens.some(isSmallClass) && tokens.some((token) => HEAVY_CLASS.test(token))) {
        report(match.index, "Tailwind class");
      }
    }

    for (const match of source.matchAll(/\{[^{}]{0,1200}\}/gs)) {
      const size = match[0].match(/fontSize\s*:\s*(?:["'](\d+(?:\.\d+)?)px["']|(\d+(?:\.\d+)?))/);
      const weight = match[0].match(/fontWeight\s*:\s*(?:["'](bold|bolder|[6-9]\d{2})["']|(\d+))/);
      if (size && weight && Number(size[1] ?? size[2]) <= 12 && isHeavyStyleWeight(weight[1] ?? weight[2])) {
        report(match.index, "inline style");
      }
    }

    for (const match of source.matchAll(/<[^>]+>/gs)) {
      const size = match[0].match(/fontSize=(?:\{(\d+(?:\.\d+)?)\}|["'](\d+(?:\.\d+)?)(?:px)?["'])/);
      const weight = match[0].match(/fontWeight=(?:\{["']?([6-9]\d{2}|bold|bolder)["']?\}|["']([6-9]\d{2}|bold|bolder)["'])/);
      if (size && weight && Number(size[1] ?? size[2]) <= 12) report(match.index, "element attribute");
    }
  }

  if (STYLE_EXTENSIONS.has(extension)) {
    for (const match of source.matchAll(/([^{}]*)\{([^{}]*)\}/gs)) {
      const size = match[2].match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
      const weight = match[2].match(/font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i);
      if (size && weight && Number(size[1]) <= 12) report(match.index, "CSS declaration");
    }
  }

  return violations;
}

const allFiles = (await Promise.all(ROOTS.map(collectFiles))).flat();
const relevantFiles = allFiles.filter((file) => {
  const extension = path.extname(file);
  return SOURCE_EXTENSIONS.has(extension) || STYLE_EXTENSIONS.has(extension);
});

if (fix) {
  let changedCount = 0;
  for (const file of relevantFiles) {
    const extension = path.extname(file);
    const source = await readFile(file, "utf8");
    let updated = source;
    if (SOURCE_EXTENSIONS.has(extension)) {
      updated = updateClassStrings(updated);
      updated = updateInlineStyles(updated);
      updated = updateElementAttributes(updated);
    } else {
      updated = updateCss(updated);
    }
    if (updated !== source) {
      await writeFile(file, updated);
      changedCount += 1;
    }
  }
  console.log(`Updated ${changedCount} files.`);
}

const failures = [];
for (const file of relevantFiles) {
  const extension = path.extname(file);
  const source = await readFile(file, "utf8");
  for (const violation of findViolations(source, extension)) {
    failures.push(`${file}:${lineNumber(source, violation.index)} ${violation.kind}`);
  }
}

if (failures.length > 0) {
  console.error("Text at 12px or below must use font weight 500 or lower:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Typography check passed: no bold text at 12px or below.");
}
