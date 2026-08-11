import { NextResponse } from "next/server";
import { getFeedbackAdminUser } from "@/lib/feedback-server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getFeedbackAdminUser();
  return NextResponse.json({ isAdmin: Boolean(user) });
}
