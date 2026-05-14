import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for a list of text chunks using OpenAI text-embedding-3-small.
 * Returns an array of float arrays (1536 dimensions each).
 */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks,
    encoding_format: "float",
  });

  return response.data.map((d) => d.embedding);
}

/**
 * Generate a single embedding for a query string.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const [embedding] = await embedChunks([query]);
  return embedding;
}
