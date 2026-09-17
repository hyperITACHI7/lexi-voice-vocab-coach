/**
 * Turns a streaming LLM response into speakable sentences, so text-to-speech can
 * start on the first sentence instead of waiting for the whole reply.
 */
export class SentenceSplitter {
  private buffer = "";

  push(delta: string): string[] {
    this.buffer += delta;
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (ch !== "\n" && !/[.!?]/.test(ch)) continue;
      // Closing quotes/brackets belong to the sentence they end: `…strengths.” Next`.
      let end = i;
      while (/["'”’)\]]/.test(this.buffer[end + 1] ?? "")) end++;
      if (ch !== "\n" && !/\s/.test(this.buffer[end + 1] ?? "x")) continue;
      const sentence = this.buffer.slice(start, end + 1).trim();
      if (sentence) out.push(sentence);
      start = end + 1;
      i = end;
    }
    this.buffer = this.buffer.slice(start);
    return out;
  }

  flush(): string | null {
    const rest = this.buffer.trim();
    this.buffer = "";
    return rest || null;
  }
}

/** Splits text into chunks of at most `max` characters, preferring clause and word boundaries. */
export function chunkText(text: string, max: number): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "));
    cut = cut > max * 0.4 ? cut + 1 : window.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Removes markdown-ish symbols the model may still emit, which TTS would read aloud. */
export function toSpeakable(text: string): string {
  return text
    .replace(/[*_#`>~]+/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
