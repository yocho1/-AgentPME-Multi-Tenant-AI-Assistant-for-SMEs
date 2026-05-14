import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "AgentPME",
  },
});

/**
 * Generate embeddings for a list of text chunks via OpenRouter.
 * Default: openai/text-embedding-3-small (1536 dimensions).
 */
export async function embedChunks(chunks: string[]): Promise<number[][]> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

  const response = await openai.embeddings.create({
    model: process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small",
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
