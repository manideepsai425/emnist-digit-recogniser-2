// app/api/predict/route.ts
// Server-side Route Handler — proxies POST /api/predict → FastAPI backend.
//
// Advantages of proxying via Next.js:
//   • NEXT_PUBLIC_API_URL stays server-only (not exposed in client bundle)
//   • Avoids CORS issues in production
//   • Can add auth, rate-limiting, or request logging here later
//   • Vercel edge caching headers can be set centrally

import { type NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "https://emnist-digit-recogniser-27.onrender.com";

export async function POST(req: NextRequest) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { detail: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(`${BACKEND}/predict`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward user agent for server-side logging on Render
        "User-Agent": req.headers.get("user-agent") ?? "neural-ink-proxy",
      },
      body: JSON.stringify(body),
      // Abort after 15 s — model cold-start on Render free tier can be slow
      signal: AbortSignal.timeout(15_000),
    });

    const data = await upstream.json();

    return NextResponse.json(data, {
      status: upstream.status,
      headers: {
        // Prevent Vercel from caching prediction responses
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "Backend timed out — the model server may be starting up. Try again in a moment."
        : "Could not reach the prediction backend.";

    return NextResponse.json({ detail: message }, { status: 502 });
  }
}

// Block all other HTTP methods on this route
export function GET()    { return NextResponse.json({ detail: "Method not allowed." }, { status: 405 }); }
export function PUT()    { return NextResponse.json({ detail: "Method not allowed." }, { status: 405 }); }
export function DELETE() { return NextResponse.json({ detail: "Method not allowed." }, { status: 405 }); }
