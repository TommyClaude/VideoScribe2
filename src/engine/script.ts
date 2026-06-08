// Script helpers for the (optional) AI script-gen module. Pure + tested; the
// network calls live in ui/ai.ts.

/** Split a script into sentence-sized lines (one idea per scene/segment). */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Prompt sent to the script-gen model for a topic. */
export function buildScriptPrompt(topic: string): string {
  return (
    `Viết kịch bản voiceover ngắn gọn (5–8 câu) cho một video whiteboard animation ` +
    `về chủ đề: "${topic}". Mỗi câu là một ý rõ ràng, dễ minh hoạ. ` +
    `Chỉ trả về phần lời thoại, không thêm tiêu đề hay giải thích.`
  );
}
