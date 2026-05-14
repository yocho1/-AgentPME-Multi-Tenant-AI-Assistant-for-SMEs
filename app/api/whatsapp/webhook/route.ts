import { NextResponse } from "next/server";
import {
  proxyWhatsAppWebhook,
  checkFastAPIHealth,
} from "@/lib/fastapi-proxy";

/**
 * GET /api/whatsapp/webhook
 * Meta WhatsApp verification challenge.
 *
 * Proxies to FastAPI backend. Verification handled by FastAPI.
 */
export async function GET(request: Request) {
  // Check if FastAPI is available
  const fastapiHealthy = await checkFastAPIHealth();

  if (!fastapiHealthy.healthy) {
    return NextResponse.json(
      { error: "WhatsApp service unavailable. Please ensure FastAPI backend is running." },
      { status: 503 }
    );
  }

  // Proxy to FastAPI
  const { searchParams } = new URL(request.url);
  const response = await proxyWhatsAppWebhook("GET", searchParams);

  if (response.ok) {
    const challenge = await response.text();
    return new NextResponse(challenge, { status: 200 });
  } else {
    return NextResponse.json({ error: "Verification failed" }, { status: 403 });
  }
}

/**
 * POST /api/whatsapp/webhook
 * Receive incoming WhatsApp messages from Meta.
 *
 * Proxies to FastAPI backend for processing.
 */
export async function POST(request: Request) {
  const body = await request.json();

  // Check if FastAPI is available
  const fastapiHealthy = await checkFastAPIHealth();

  if (!fastapiHealthy.healthy) {
    return NextResponse.json(
      { error: "WhatsApp service unavailable. Please ensure FastAPI backend is running." },
      { status: 503 }
    );
  }

  // Proxy to FastAPI
  const response = await proxyWhatsAppWebhook("POST", undefined, body);

  if (response.ok) {
    const data = await response.json();
    return NextResponse.json(data);
  } else {
    const error = await response.text();
    return NextResponse.json(
      { error: "WhatsApp processing failed", detail: error },
      { status: response.status }
    );
  }
}
