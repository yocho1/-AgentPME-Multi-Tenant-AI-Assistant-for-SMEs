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
// OpenRouter LLM (OpenAI-compatible)
// Default free model: meta-llama/llama-3.1-8b-instruct:free
// ============================================================
const model = new ChatOpenAI({
  model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
  temperature: 0.3,
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "AgentPME",
    },
  },
  maxTokens: 1024,
});

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
// Node: Generate response with OpenRouter LLM
// ============================================================
async function generateNode(state: AgentState): Promise<Partial<AgentState>> {
  const systemPrompt = new SystemMessage(
    `You are AgentPME, a helpful AI assistant for a small business. ` +
      `Answer the customer's question based ONLY on the provided context below. ` +
      `If the context doesn't contain the answer, say you don't know and offer to escalate to a human. ` +
      `Be concise, friendly, and professional.\n\n` +
      `Context:\n${state.context}`
  );

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
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

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
