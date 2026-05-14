/**
 * Simple recursive text chunking.
 * Strategy: split by double newlines (paragraphs), then single newlines,
 * then sentences, then words. Each chunk targets ~maxChars characters.
 */
export function chunkText(text: string, maxChars = 1000, overlap = 100): string[] {
  const separators = ["\n\n", "\n", ". ", " "];
  const chunks: string[] = [];

  function splitRecursive(input: string, sepIndex: number): string[] {
    if (input.length <= maxChars) return [input];
    if (sepIndex >= separators.length) {
      // Hard character split
      const result: string[] = [];
      for (let i = 0; i < input.length; i += maxChars) {
        result.push(input.slice(i, i + maxChars));
      }
      return result;
    }

    const sep = separators[sepIndex];
    const parts = input.split(sep);
    const current: string[] = [];
    let buffer = "";

    for (const part of parts) {
      const candidate = buffer ? buffer + sep + part : part;
      if (candidate.length <= maxChars) {
        buffer = candidate;
      } else {
        if (buffer) current.push(buffer);
        buffer = part;
        if (buffer.length > maxChars) {
          current.push(...splitRecursive(buffer, sepIndex + 1));
          buffer = "";
        }
      }
    }
    if (buffer) current.push(buffer);
    return current;
  }

  const rawChunks = splitRecursive(text.trim(), 0);

  // Add overlap between chunks for continuity
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i];
    if (i > 0 && overlap > 0) {
      const prev = rawChunks[i - 1];
      const overlapText = prev.slice(-overlap);
      chunk = overlapText + "\n" + chunk;
    }
    chunks.push(chunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}
