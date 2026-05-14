import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { embedQuery } from "@/lib/embeddings";
import { retrieveRelevantChunks } from "@/lib/retrieval";

// ============================================================
// Agent State
// ============================================================
interface AgentState {
  messages: BaseMessage[];
  context: string;
  tenantId: string;
}

// ============================================================
// Lazy LLM factory — creates a fresh instance per request
// so env vars are read at runtime, not cached at import time.
// ============================================================
function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }
  // apiKey MUST be inside configuration object for custom baseURL
  // @langchain/openai v1.x ignores openAIApiKey when configuration is provided.
  return new ChatOpenAI({
    model: process.env.OPENROUTER_MODEL || "openai/gpt-3.5-turbo",
    temperature: 0.3,
    configuration: {
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "AgentPME",
      },
    },
    maxTokens: 1024,
  });
}

// ============================================================
// Node: Retrieve relevant chunks from knowledge base
// ============================================================
async function retrieveNode(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!(lastMessage instanceof HumanMessage)) {
    return { context: state.context };
  }

  const query = lastMessage.content.toString();
  const queryEmbedding = await embedQuery(query);
  const chunks = await retrieveRelevantChunks(state.tenantId, queryEmbedding, 5);

  if (chunks.length === 0) {
    return { context: "No relevant documents found." };
  }

  const contextText = chunks
    .map((c, i) => `[${i + 1}] ${c.content}`)
    .join("\n\n---\n\n");

  return { context: contextText };
}

// ============================================================
// Language detection (lightweight heuristic)
// ============================================================
function detectLanguage(text: string): "ar" | "fr" | "en" {
  // Arabic Unicode range
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  // French indicators
  const frenchWords = /\b(bonjour|salut|merci|bon|comment|quel|où|quand|pourquoi|combien|je|tu|il|elle|nous|vous|ils|elles|être|avoir|faire|aller|voir|savoir|pouvoir|vouloir|venir|prendre|trouver|donner|falloir|tenir|porter|parler|montrer|continuer|penser|suivre|connaître|comprendre|rester|croire|entendre|passer|regarder|commencer|devenir|sentir|attendre|sortir|arriver|rentrer|entrer|revenir|devenir|rester|revenir)\b/i;
  if (frenchWords.test(text)) return "fr";
  return "en";
}

function languageInstruction(lang: "ar" | "fr" | "en"): string {
  if (lang === "ar") {
    return "يجيب باللغة العربية فقط.";
  }
  if (lang === "fr") {
    return "Répondez en français uniquement.";
  }
  return "Respond in English only.";
}

// ============================================================
// Node: Generate response with OpenRouter LLM
// ============================================================
async function generateNode(state: AgentState): Promise<Partial<AgentState>> {
  const lastUserMsg = state.messages
    .slice()
    .reverse()
    .find((m) => m instanceof HumanMessage);
  const lang = lastUserMsg ? detectLanguage(lastUserMsg.content.toString()) : "en";

  const systemPrompt = new SystemMessage(
    `You are AgentPME, a helpful AI assistant for a small business. ` +
      `Answer the customer's question based ONLY on the provided context below. ` +
      `If the context doesn't contain the answer, say you don't know and offer to escalate to a human. ` +
      `Be concise, friendly, and professional. ` +
      `${languageInstruction(lang)}\n\n` +
      `Context:\n${state.context}`
  );

  const model = getModel();
  const response = await model.invoke([systemPrompt, ...state.messages]);
  return { messages: [...state.messages, response] };
}

// ============================================================
// Build LangGraph
// ============================================================
const graphBuilder = new StateGraph<AgentState>({
  channels: {
    messages: {
      value: (x: BaseMessage[], y: BaseMessage[]) => [...x, ...y],
      default: () => [],
    },
    context: {
      value: (_x: string, y: string) => y,
      default: () => "",
    },
    tenantId: {
      value: (_x: string, y: string) => y,
      default: () => "",
    },
  },
});

graphBuilder
  .addNode("retrieve", retrieveNode)
  .addNode("generate", generateNode)
  .addEdge(START, "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", END);

const agentGraph = graphBuilder.compile();

// ============================================================
// Public interface: run the agent on a conversation
// ============================================================
export async function runAgent(
  tenantId: string,
  messages: { role: "user" | "assistant" | "system"; content: string }[]
): Promise<string> {
  const baseMessages: BaseMessage[] = messages.map((m) => {
    if (m.role === "user") return new HumanMessage(m.content);
    if (m.role === "assistant") return new AIMessage(m.content);
    return new SystemMessage(m.content);
  });

  const result = (await agentGraph.invoke({
    messages: baseMessages,
    context: "",
    tenantId,
  })) as unknown as AgentState;

  const lastMsg = result.messages[result.messages.length - 1];
  return lastMsg.content.toString();
}
