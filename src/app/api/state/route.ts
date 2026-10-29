import { NextResponse } from "next/server";
import { getAppState } from "@/lib/service";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(await getAppState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
