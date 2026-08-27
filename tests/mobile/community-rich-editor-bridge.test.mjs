import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chromium } from "playwright";

const SOURCE_PATH = new URL("../../mobile/components/community/community-rich-editor.tsx", import.meta.url);

function productionEditorHtml(content) {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const startMarker = "  return `<!doctype html>";
  const start = source.indexOf(startMarker);
  const end = source.indexOf("`;" + "\n}", start);
  assert.notEqual(start, -1, "native editor HTML template must exist");
  assert.notEqual(end, -1, "native editor HTML template must terminate");

  const alignmentButtons = source.match(/const IMAGE_ALIGNMENT_BUTTONS = '([^']+)';/)?.[1];
  assert.ok(alignmentButtons, "image alignment toolbar markup must exist");

  return source
    .slice(start + "  return `".length, end)
    .replaceAll("${safeContent}", content)
    .replaceAll("${IMAGE_ALIGNMENT_BUTTONS}", alignmentButtons)
    .replaceAll("${MAX_POLL_OPTIONS}", "6")
    .replace(/\$\{EDITOR_FONT_URIS\.(?:regular|medium|bold)\}/g, "about:blank")
    .replace(/\$\{colors\.[A-Za-z]+\}/g, "#222222")
    .replace(
      "<script>",
      "<script>window.__nativeMessages=[];window.ReactNativeWebView={postMessage(value){window.__nativeMessages.push(JSON.parse(value))}};",
    );
}

async function withEditor(content, run) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { height: 844, width: 390 } });
  try {
    await page.setContent(productionEditorHtml(content));
    await page.waitForFunction(() => typeof window.minionCommand === "function");
    await run(page);
  } finally {
    await browser.close();
  }
}

async function latestDocument(page) {
  await page.waitForFunction(() => window.__nativeMessages?.some((message) => message.type === "change"));
  return page.evaluate(() => window.__nativeMessages.filter((message) => message.type === "change").at(-1).document);
}

test("empty editor keeps the caret on the placeholder line", async () => {
  await withEditor("<p><br></p>", async (page) => {
    const layout = await page.locator("#editor").evaluate((editor) => {
      const paragraph = editor.querySelector(":scope > p");
      const editorRect = editor.getBoundingClientRect();
      const paragraphRect = paragraph.getBoundingClientRect();
      const placeholder = getComputedStyle(editor, "::before");
      return {
        paragraphTop: paragraphRect.top - editorRect.top,
        placeholderPosition: placeholder.position,
        placeholderTop: Number.parseFloat(placeholder.top),
      };
    });

    assert.equal(layout.placeholderPosition, "absolute");
    assert.equal(layout.placeholderTop, 16);
    assert.equal(layout.paragraphTop, 16);
  });
});

test("media commands insert top-level images, poll, YouTube, and SNS nodes from a text caret", async () => {
  await withEditor("<p>앞 문장</p>", async (page) => {
    await page.evaluate(() => {
      const paragraph = document.querySelector("#editor > p");
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);

      window.minionCommand("insertImage", { aspectRatio: 16 / 9, src: "https://example.test/image-1.webp", width: 640 });
      window.minionCommand("insertImage", { aspectRatio: 4 / 3, src: "https://example.test/image-2.webp", width: 480 });
      window.minionCommand("insertPoll", {
        pollId: "11111111-1111-4111-8111-111111111111",
        question: "어느 쪽?",
        options: [
          { id: "22222222-2222-4222-8222-222222222222", label: "첫 번째" },
          { id: "33333333-3333-4333-8333-333333333333", label: "두 번째" },
        ],
      });
      window.minionCommand("insertYoutube", "https://www.youtube.com/embed/dQw4w9WgXcQ");
      window.minionCommand("insertEmbed", { type: "instagram", url: "https://www.instagram.com/p/example/" });
    });

    const document = await latestDocument(page);
    assert.deepEqual(document.content.map((node) => node.type), ["paragraph", "imageResize", "imageResize", "poll", "youtube", "embed", "paragraph"]);
    assert.equal(document.content[0].content[0].text, "앞 문장");
    assert.equal(document.content[1].attrs.src, "https://example.test/image-1.webp");
    assert.equal(document.content[1].attrs.width, 640);
    assert.equal(document.content[1].attrs.height, 360);
    assert.equal(document.content[2].attrs.src, "https://example.test/image-2.webp");
    assert.equal(document.content[2].attrs.height, 360);
    assert.equal(document.content[3].attrs.question, "어느 쪽?");
    assert.deepEqual(document.content[3].attrs.options.map((option) => option.label), ["첫 번째", "두 번째"]);
    assert.equal(document.content[4].attrs.src, "https://www.youtube.com/embed/dQw4w9WgXcQ");
    assert.equal(document.content[5].attrs.type, "instagram");
    assert.doesNotMatch(JSON.stringify(document), /선택지는 최대|YOU·TUBE/);

    await page.locator(".image-shell img").first().click();
    await page.locator(".image-shell").first().locator("[data-image-align=center]").click();
    const aligned = await latestDocument(page);
    assert.match(aligned.content[1].attrs.wrapperStyle, /justify-content: center/);
  });
});

test("inline formatting and list commands survive native serialization", async () => {
  await withEditor("<p>서식 테스트</p>", async (page) => {
    await page.evaluate(() => {
      const text = document.querySelector("#editor > p").firstChild;
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
      window.minionCommand("bold");
      window.minionCommand("italic");
      window.minionCommand("underline");
      window.minionCommand("foreColor", "#ef4444");
      window.minionCommand("highlight", "#fef08a");
      window.minionCommand("fontSize", 20);
    });

    const document = await latestDocument(page);
    const marks = document.content[0].content[0].marks;
    assert.deepEqual(new Set(marks.map((mark) => mark.type)), new Set(["bold", "italic", "underline", "textStyle", "highlight"]));
    assert.equal(marks.find((mark) => mark.type === "textStyle").attrs.fontSize, "18px");
  });

  await withEditor("<p>목록 항목</p>", async (page) => {
    await page.evaluate(() => {
      const text = document.querySelector("#editor > p").firstChild;
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      window.minionCommand("insertUnorderedList");
    });
    const document = await latestDocument(page);
    const editorMarkup = await page.locator("#editor").evaluate((editor) => editor.innerHTML);
    assert.equal(document.content[0].type, "bulletList", `editor DOM: ${editorMarkup}`);
    assert.equal(document.content[0].content[0].type, "listItem");
    assert.equal(document.content[0].content[0].content[0].content[0].text, "목록 항목");
  });

  await withEditor("<p>번호 항목</p>", async (page) => {
    await page.evaluate(() => {
      const text = document.querySelector("#editor > p").firstChild;
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      window.minionCommand("insertOrderedList");
    });
    const document = await latestDocument(page);
    assert.equal(document.content[0].type, "orderedList");
    assert.equal(document.content[0].content[0].content[0].content[0].text, "번호 항목");
  });
});

test("poll update/delete and undo/redo commands keep the document synchronized", async () => {
  await withEditor("<p>명령 테스트</p>", async (page) => {
    await page.evaluate(() => {
      window.minionCommand("insertPoll", {
        pollId: "11111111-1111-4111-8111-111111111111",
        question: "처음 질문",
        options: [{ id: "a", label: "A" }, { id: "b", label: "B" }],
      });
      window.minionCommand("updatePoll", {
        pollId: "11111111-1111-4111-8111-111111111111",
        question: "수정 질문",
        options: [{ id: "a", label: "수정 A" }, { id: "b", label: "수정 B" }],
      });
    });
    let document = await latestDocument(page);
    assert.equal(document.content.find((node) => node.type === "poll").attrs.question, "수정 질문");

    await page.evaluate(() => window.minionCommand("deletePoll", "11111111-1111-4111-8111-111111111111"));
    document = await latestDocument(page);
    assert.equal(document.content.some((node) => node.type === "poll"), false);

    await page.evaluate(() => {
      const text = document.querySelector("#editor > p").firstChild;
      const selection = getSelection();
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
      window.minionCommand("bold");
      window.minionCommand("undo");
      window.minionCommand("redo");
    });
    document = await latestDocument(page);
    assert.equal(document.content[0].content[0].marks.some((mark) => mark.type === "bold"), true);
  });
});

test("flush captures the latest keystroke before the delayed input emit", async () => {
  await withEditor("<p><br></p>", async (page) => {
    await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      editor.innerHTML = "<p>등록 직전 입력</p>";
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      window.minionCommand("flush", "submit-request");
    });
    await page.waitForFunction(() => window.__nativeMessages.some((message) => message.type === "flush" && message.requestId === "submit-request"));
    const flushed = await page.evaluate(() => window.__nativeMessages.find((message) => message.type === "flush" && message.requestId === "submit-request").document);
    assert.equal(flushed.content[0].content[0].text, "등록 직전 입력");
  });
});

test("existing structured blocks round-trip without becoming display text", async () => {
  const pollOptions = encodeURIComponent(JSON.stringify([
    { id: "option-a", label: "A" },
    { id: "option-b", label: "B" },
  ]));
  const content = [
    '<div class="image-shell" contenteditable="false" data-image-shell="true" data-align="right" data-aspect-ratio="1.5"><div class="image-frame"><img src="https://example.test/existing.webp" alt="기존 이미지" style="width:300px"></div></div>',
    `<div class="poll-block" contenteditable="false" data-poll-id="poll-existing" data-poll-question="기존 투표" data-poll-options="${pollOptions}"><b>기존 투표</b><small>선택지는 최대 6개까지 추가할 수 있어요.</small></div>`,
    '<div class="media-block youtube-block" contenteditable="false" data-youtube-url="https://www.youtube.com/embed/dQw4w9WgXcQ"><p>YOU·TUBE</p></div>',
  ].join("");

  await withEditor(content, async (page) => {
    await page.evaluate(() => {
      const poll = document.querySelector("[data-poll-id]");
      poll.dataset.pollOptions = decodeURIComponent(poll.dataset.pollOptions);
      window.minionCommand("bold");
    });
    const document = await latestDocument(page);
    assert.deepEqual(document.content.map((node) => node.type), ["imageResize", "poll", "youtube"]);
    assert.equal(document.content[0].attrs.height, 200);
    assert.match(document.content[0].attrs.wrapperStyle, /justify-content: flex-end/);
    assert.deepEqual(document.content[1].attrs.options.map((option) => option.label), ["A", "B"]);
    assert.doesNotMatch(JSON.stringify(document), /선택지는 최대|YOU·TUBE/);
  });
});
