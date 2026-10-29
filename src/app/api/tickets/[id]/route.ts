import { NextResponse } from "next/server";
import { updateTicket } from "@/lib/service";
import { errorResponse, readJson } from "@/lib/http";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await updateTicket(id, await readJson(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
