import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const mobileRoot = path.join(root, "mobile");
const wrapperPath = path.join(mobileRoot, "components", "keyboard-aware-view.tsx");
const hookPath = path.join(mobileRoot, "hooks", "use-keyboard-layout.ts");

async function source(filePath) {
  return readFile(filePath, "utf8");
}

async function codeFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".expo", "dist"].includes(entry.name) || entry.name.startsWith("dist-")) return [];
      return codeFiles(filePath);
    }
    return /\.[jt]sx?$/.test(entry.name) ? [filePath] : [];
  }));
  return files.flat();
}

test("keyboard state and safe-area calculations have one source of truth", async () => {
  const hook = await source(hookPath);
  assert.match(hook, /Keyboard\.isVisible\(\)/);
  assert.match(hook, /keyboardVisible \? minimumBottomInset : Math\.max\(insets\.bottom, minimumBottomInset\)/);
  assert.match(hook, /keyboardWillShow/);
  assert.match(hook, /keyboardDidHide/);
  assert.match(hook, /Platform\.OS === 'ios' \? 'padding' : 'height'/);

  const files = await codeFiles(mobileRoot);
  for (const filePath of files) {
    if (filePath === hookPath) continue;
    assert.doesNotMatch(await source(filePath), /Keyboard\.addListener\(/, `${path.relative(root, filePath)} must use useKeyboardLayout`);
  }
});

test("keyboard avoidance is only configured by KeyboardAwareView", async () => {
  const wrapper = await source(wrapperPath);
  assert.match(wrapper, /behavior=\{state\.behavior\}/);
  assert.match(wrapper, /enabled=\{state\.keyboardVisible\}/);

  const files = await codeFiles(mobileRoot);
  for (const filePath of files) {
    if (filePath === wrapperPath) continue;
    assert.doesNotMatch(await source(filePath), /\bKeyboardAvoidingView\b/, `${path.relative(root, filePath)} must use KeyboardAwareView`);
  }
});

test("mobile web keeps fixed input docks inside the resized keyboard viewport", async () => {
  const layout = await source(path.join(root, "app", "layout.tsx"));
  const commentForm = await source(path.join(root, "components", "community", "comment-form.tsx"));
  const mobilePost = await source(path.join(mobileRoot, "components", "community", "community-post-screen.tsx"));
  assert.match(layout, /interactiveWidget:\s*["']resizes-content["']/);
  assert.match(commentForm, /focus-within:pb-2/);
  assert.match(commentForm, /toggleMiniconPanel[\s\S]*inputRef\.current\?\.blur\(\)/);
  assert.match(mobilePost, /toggleMiniconPicker[\s\S]*Keyboard\.dismiss\(\)/);
});

test("Android native builds request resized keyboard windows", async () => {
  const appConfig = JSON.parse(await source(path.join(mobileRoot, "app.json")));
  assert.equal(appConfig.expo.android.softwareKeyboardLayoutMode, "resize");
});
