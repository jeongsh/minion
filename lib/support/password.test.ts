import assert from "node:assert/strict";
import test from "node:test";

import { hashInquiryPassword, verifyInquiryPassword } from "./password.ts";

test("verifies a password against its own hash", () => {
  const hash = hashInquiryPassword("correct horse");
  assert.equal(verifyInquiryPassword("correct horse", hash), true);
});

test("rejects a wrong password", () => {
  const hash = hashInquiryPassword("correct horse");
  assert.equal(verifyInquiryPassword("wrong password", hash), false);
});

test("two hashes of the same password differ (random salt) but both verify", () => {
  const first = hashInquiryPassword("battery staple");
  const second = hashInquiryPassword("battery staple");
  assert.notEqual(first, second);
  assert.equal(verifyInquiryPassword("battery staple", first), true);
  assert.equal(verifyInquiryPassword("battery staple", second), true);
});

test("rejects malformed stored hashes instead of throwing", () => {
  assert.equal(verifyInquiryPassword("anything", ""), false);
  assert.equal(verifyInquiryPassword("anything", "not-a-valid-hash"), false);
  assert.equal(verifyInquiryPassword("anything", "salt-without-hash:"), false);
});
