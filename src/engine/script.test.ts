import { describe, it, expect } from "vitest";
import { buildScriptPrompt, splitSentences } from "./script";

describe("splitSentences", () => {
  it("splits on sentence punctuation", () => {
    expect(splitSentences("Hello world. How are you? Fine!")).toEqual([
      "Hello world.",
      "How are you?",
      "Fine!",
    ]);
  });

  it("splits on newlines too and trims", () => {
    expect(splitSentences("One idea\n  Two idea \n\nThree")).toEqual([
      "One idea",
      "Two idea",
      "Three",
    ]);
  });

  it("drops empty fragments", () => {
    expect(splitSentences("   \n\n  ")).toEqual([]);
  });
});

describe("buildScriptPrompt", () => {
  it("includes the topic", () => {
    expect(buildScriptPrompt("cây quang hợp")).toContain("cây quang hợp");
  });
});
