import { NextResponse } from "next/server";
import { reportTicket } from "@/lib/service";
import { errorResponse, readJson } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return NextResponse.json(await reportTicket(await readJson(request)), {
      status: 201,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
