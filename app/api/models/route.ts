// app/api/models/route.ts
import { LLMManager } from '@/app/lib/modules/llm/manager';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const manager = LLMManager.getInstance();
    // Always use server-managed OpenRouter API key
    const modelList = await manager.updateModelList({
      apiKeys: { OpenRouter: process.env.OPENROUTER_API_KEY ?? '' },
      providerSettings: {},
    });
    return NextResponse.json({ modelList });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}
