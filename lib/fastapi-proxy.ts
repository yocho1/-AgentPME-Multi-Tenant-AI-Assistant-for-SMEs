/**
 * FastAPI proxy utilities for Next.js → FastAPI communication.
 *
 * All AI-heavy operations are delegated to the FastAPI backend.
 */

const FASTAPI_BASE_URL = process.env.FASTAPI_URL || "http://localhost:8000/api/v1";
const FASTAPI_API_KEY = process.env.FASTAPI_API_KEY || "";

interface ProxyOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  tenantId?: string;
  userJwt?: string;
}

/**
 * Proxy a request to the FastAPI backend.
 *
 * @param endpoint - FastAPI endpoint (e.g., "/chat", "/documents/upload")
 * @param options - Request options
 * @returns Response from FastAPI
 */
export async function proxyToFastAPI(
  endpoint: string,
  options: ProxyOptions = {}
): Promise<Response> {
  const {
    method = "GET",
    body,
    headers = {},
    tenantId,
    userJwt,
  } = options;

  // Build URL
  const url = new URL(`${FASTAPI_BASE_URL}${endpoint}`);

  // Add tenant_id as query param for GET requests if provided
  if (method === "GET" && tenantId) {
    url.searchParams.set("tenant_id", tenantId);
  }

  // Build headers
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": FASTAPI_API_KEY,
    ...headers,
  };

  // Add user JWT if provided (for RLS-respecting operations)
  if (userJwt) {
    requestHeaders["Authorization"] = `Bearer ${userJwt}`;
  }

  // Build request init
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };

  // Add body for non-GET requests
  if (body && method !== "GET") {
    // Add tenant_id to body if not present
    if (tenantId && !body.tenant_id) {
      body.tenant_id = tenantId;
    }
    init.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), init);
    return response;
  } catch (error) {
    console.error("[FastAPI Proxy] Request failed:", error);
    throw new Error(`FastAPI proxy failed: ${error}`);
  }
}

/**
 * Proxy chat request to FastAPI.
 */
export async function proxyChat(
  message: string,
  tenantId: string,
  conversationId?: string,
  channel: "widget" | "whatsapp" = "widget",
  stream: boolean = false
): Promise<Response> {
  const endpoint = stream ? "/chat/stream" : "/chat/";

  return proxyToFastAPI(endpoint, {
    method: "POST",
    body: {
      message,
      tenant_id: tenantId,
      conversation_id: conversationId,
      channel,
      stream,
    },
    tenantId,
  });
}

/**
 * Proxy document upload to FastAPI.
 */
export async function proxyDocumentUpload(
  file: File,
  tenantId: string
): Promise<Response> {
  const url = `${FASTAPI_BASE_URL}/documents/upload?tenant_id=${tenantId}`;

  const formData = new FormData();
  formData.append("file", file);

  return fetch(url, {
    method: "POST",
    headers: {
      "X-API-Key": FASTAPI_API_KEY,
    },
    body: formData,
  });
}

/**
 * Proxy WhatsApp webhook to FastAPI.
 */
export async function proxyWhatsAppWebhook(
  method: "GET" | "POST",
  searchParams?: URLSearchParams,
  body?: Record<string, unknown>
): Promise<Response> {
  const url = new URL(`${FASTAPI_BASE_URL}/whatsapp/webhook`);

  if (searchParams) {
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }

  return fetch(url.toString(), {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": FASTAPI_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Check FastAPI health status.
 */
export async function checkFastAPIHealth(): Promise<{
  healthy: boolean;
  version?: string;
}> {
  try {
    const response = await fetch(`${FASTAPI_BASE_URL}/health/`, {
      method: "GET",
      headers: {
        "X-API-Key": FASTAPI_API_KEY,
      },
    });

    if (!response.ok) {
      return { healthy: false };
    }

    const data = await response.json();
    return {
      healthy: data.status === "healthy",
      version: data.version,
    };
  } catch {
    return { healthy: false };
  }
}
