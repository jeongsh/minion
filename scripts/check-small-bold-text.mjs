import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const STYLE_EXTENSIONS = new Set([".css", ".less", ".sass", ".scss"]);
const HEAVY_CLASS = /^(?:[^\s]+:)*font-(?:semibold|bold|extrabold|black|\[(?:[6-9]\d{2})\])$/;
const HEAVY_CLASS_GLOBAL = /(?<![\w-])((?:[^\s"'`]+:)*)(font-(?:semibold|bold|extrabold|black|\[(?:[6-9]\d{2})\]))(?![\w-])/g;
const SMALL_CLASS = /^(?:[^\s]+:)*text-(?:xs|\[(\d+(?:\.\d+)?)px\])$/;
const STRING_LITERAL = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/gs;
const fix = process.argv.includes("--fix");
const strict = process.argv.includes("--strict");
const targets = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const weightSizeLimit = strict ? 14 : 12;

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
  if (strict && /^(?:[^\s]+:)*!?text-sm$/.test(token)) return true;
  const match = token.match(SMALL_CLASS);
  if (!match) return false;
  return match[1] === undefined || Number(match[1]) <= weightSizeLimit;
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
    for (const match of strict ? [] : source.matchAll(STRING_LITERAL)) {
      const tokens = match[0].slice(1, -1).split(/\s+/);
      if (tokens.some(isSmallClass) && tokens.some((token) => HEAVY_CLASS.test(token))) {
        report(match.index, "Tailwind class");
      }
    }

    for (const match of source.matchAll(/\{[^{}]{0,1200}\}/gs)) {
      const size = match[0].match(/fontSize\s*:\s*(?:["'](\d+(?:\.\d+)?)px["']|(\d+(?:\.\d+)?))/);
      const weight = match[0].match(/fontWeight\s*:\s*(?:["'](bold|bolder|[6-9]\d{2})["']|(\d+))/);
      if (size && weight && Number(size[1] ?? size[2]) <= weightSizeLimit && isHeavyStyleWeight(weight[1] ?? weight[2])) {
        report(match.index, "inline style");
      }
    }

    for (const match of source.matchAll(/<[^>]+>/gs)) {
      const size = match[0].match(/fontSize=(?:\{(\d+(?:\.\d+)?)\}|["'](\d+(?:\.\d+)?)(?:px)?["'])/);
      const weight = match[0].match(/fontWeight=(?:\{["']?([6-9]\d{2}|bold|bolder)["']?\}|["']([6-9]\d{2}|bold|bolder)["'])/);
      if (size && weight && Number(size[1] ?? size[2]) <= weightSizeLimit) report(match.index, "element attribute");
    }
  }

  if (STYLE_EXTENSIONS.has(extension)) {
    for (const match of source.matchAll(/([^{}]*)\{([^{}]*)\}/gs)) {
      const size = match[2].match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
      const weight = match[2].match(/font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i);
      if (size && weight && Number(size[1]) <= weightSizeLimit) report(match.index, "CSS declaration");
    }
  }

  return violations;
}

async function collectTarget(target) {
  return (await stat(target)).isDirectory() ? collectFiles(target) : [target];
}

const allFiles = (await Promise.all((targets.length ? targets : ROOTS).map(collectTarget))).flat();
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
const ts = strict ? await import("typescript") : null;

function findStrictJsxViolations(source, file) {
  const results = [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const alternatives = (node) => {
    if (!node) return [""];
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) return alternatives(node.expression);
    if (ts.isConditionalExpression(node)) return [...alternatives(node.whenTrue), ...alternatives(node.whenFalse)];
    if (ts.isTemplateExpression(node)) {
      let values = [node.head.text];
      for (const span of node.templateSpans) values = values.flatMap((value) => alternatives(span.expression).map((part) => value + part + span.literal.text)).slice(0, 128);
      return values;
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return alternatives(node.left).flatMap((left) => alternatives(node.right).map((right) => left + right));
    return [""];
  };
  const classesOf = (element) => {
    const attribute = element.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText(tree) === "className");
    return alternatives(attribute?.initializer);
  };
  const visit = (node, inherited = "") => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const element = ts.isJsxElement(node) ? node.openingElement : node;
      for (const classes of classesOf(element)) {
        if (/\bsr-only\b/.test(classes)) continue;
        const textClasses = classes.match(/(?:^|\s)(?:[\w-]+:)*!?text-(?:xs|sm|base|lg|xl|\[\d+(?:\.\d+)?px\])(?=\s|$)/g);
        const inheritedSizes = inherited.match(/(?:^|\s)(?:[\w-]+:)*!?text-(?:xs|sm|\[\d+(?:\.\d+)?px\])(?=\s|$)/g)?.join(" ") ?? "";
        const ownWeight = /(?:^|\s)(?:[\w-]+:)*!?font-(?:normal|medium|semibold|bold|extrabold|black)(?=\s|$)/.test(classes);
        const inheritedWeight = inherited.match(/(?:^|\s)(?:[\w-]+:)*!?font-(?:normal|medium|semibold|bold|extrabold|black)(?=\s|$)/g)?.join(" ") ?? "";
        const effective = `${classes} ${textClasses ? "" : inheritedSizes} ${ownWeight ? "" : inheritedWeight}`;
        const minimum = [...effective.matchAll(/(?:^|\s)(?:[\w-]+:)*!?text-\[(\d+(?:\.\d+)?)px\]/g)].map((match) => Number(match[1]));
        const report = (kind) => results.push({ index: element.getStart(tree), kind });
        if (minimum.some((size) => size < 12)) report("Visible text must be at least 12px");
        const ownText = ts.isJsxElement(node) ? node.children.map((child) => ts.isJsxText(child) ? child.text : ts.isJsxExpression(child) && child.expression && ts.isStringLiteralLike(child.expression) ? child.expression.text : "").join("") : "";
        if (/[\uAC00-\uD7A3]/.test(ownText) && (/\btext-xs\b/.test(effective) || minimum.some((size) => size < 13))) report("Korean text must be at least 13px");
        const tokens = effective.split(/\s+/);
        if (tokens.some(isSmallClass) && tokens.some((token) => HEAVY_CLASS.test(token))) report("Inherited text at 14px or below must use weight 500 or lower");
        if (/\bfont-paperozi\b/.test(classes) && /^(button|input|select|textarea|th|td|label|a|Link|nav|p|span)$/.test(element.tagName.getText(tree))) report("UI controls and supporting text must use Pretendard");
        if (ts.isJsxElement(node)) node.children.forEach((child) => visit(child, effective));
      }
      return;
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      for (const classes of alternatives(node)) {
        if (/\bsr-only\b/.test(classes)) continue;
        const tokens = classes.split(/\s+/);
        if (tokens.some(isSmallClass) && tokens.some((token) => HEAVY_CLASS.test(token))) results.push({ index: node.getStart(tree), kind: "Class helper text at 14px or below must use weight 500 or lower" });
        if (/\btext-\[(?:\d|1[01])(?:\.\d+)?px\]/.test(classes)) results.push({ index: node.getStart(tree), kind: "Class helper text must be at least 12px" });
      }
      return;
    }
    ts.forEachChild(node, (child) => visit(child, inherited));
  };
  visit(tree);
  return results;
}

for (const file of relevantFiles) {
  const extension = path.extname(file);
  const source = await readFile(file, "utf8");
  for (const violation of findViolations(source, extension)) {
    failures.push(`${file}:${lineNumber(source, violation.index)} ${violation.kind}`);
  }
  if (strict && /\.[jt]sx$/.test(file)) {
    for (const violation of findStrictJsxViolations(source, file)) {
      failures.push(`${file}:${lineNumber(source, violation.index)} ${violation.kind}`);
    }
  }
}

if (failures.length > 0) {
  console.error(strict ? "Design typography violations (minimum size, Korean text, UI font and weight):" : "Text at 12px or below must use font weight 500 or lower:");
  for (const failure of new Set(failures)) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log(strict ? "Strict typography check passed for the selected targets. Dynamic text and computed styles still require browser verification." : "Typography check passed: no bold text at 12px or below.");
}
