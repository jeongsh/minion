import assert from "node:assert/strict";
import test from "node:test";

import {
  MINICON_MAX_MULTIPART_BODY_BYTES,
  readBoundedMiniconFormData,
} from "./bounded-multipart.ts";

test("정상 multipart 본문을 FormData로 복원한다", async () => {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "minicon.png");

  const result = await readBoundedMiniconFormData(new Request("http://minion.local/upload", {
    method: "POST",
    body: formData,
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;

  const file = result.formData.get("file");
  assert.ok(file instanceof File);
  assert.equal(file.name, "minicon.png");
  assert.equal(file.type, "image/png");
  assert.equal(file.size, 3);
});

test("선언된 Content-Length가 제한을 넘으면 본문을 읽기 전에 거절한다", async () => {
  const result = await readBoundedMiniconFormData(new Request("http://minion.local/upload", {
    method: "POST",
    headers: {
      "content-length": String(MINICON_MAX_MULTIPART_BODY_BYTES + 1),
      "content-type": "multipart/form-data; boundary=minicon-test",
    },
    body: new Uint8Array([1]),
  }));

  assert.deepEqual(result, {
    ok: false,
    error: "미니콘은 파일당 2MB 이하여야 합니다.",
    status: 413,
  });
});

test("축소된 Content-Length와 무관하게 실제 스트림 초과를 거절한다", async () => {
  const firstChunk = new Uint8Array(MINICON_MAX_MULTIPART_BODY_BYTES);
  const overflowChunk = new Uint8Array([1]);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(firstChunk);
      controller.enqueue(overflowChunk);
      controller.close();
    },
  });

  const result = await readBoundedMiniconFormData(new Request("http://minion.local/upload", {
    method: "POST",
    headers: {
      "content-length": "1",
      "content-type": "multipart/form-data; boundary=minicon-test",
    },
    body,
    duplex: "half",
  } as RequestInit));

  assert.deepEqual(result, {
    ok: false,
    error: "미니콘은 파일당 2MB 이하여야 합니다.",
    status: 413,
  });
});
