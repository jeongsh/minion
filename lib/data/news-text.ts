import "server-only";

import { load } from "cheerio";

export function decodeNewsText(value = "") {
  let text = value.replace(/<[^>]*>/g, "");
  while (true) {
    const decoded = load(text.replace(/</g, "&lt;"), null, false).text();
    if (decoded === text) return text.replace(/\s+/g, " ").trim();
    text = decoded;
  }
}
