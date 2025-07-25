import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = await req.json();
    if (!userId || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const user = await db.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });
    return NextResponse.json({ credits: user.credits });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add credits" }, { status: 500 });
  }
} 