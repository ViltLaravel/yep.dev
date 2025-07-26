// app/api/enhancer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model price per token (example, adjust as needed)
const MODEL_PRICES: Record<string, number> = {
  'deepseek/deepseek-chat-v3-0324:free': 0.00001, // $/token, example
  'openai/gpt-4o-mini': 0.00002,
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await db.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { message, model, provider } = await request.json();

    // Validate inputs
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing message' }, { status: 400 });
    }
    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing model' }, { status: 400 });
    }
    if (!provider || typeof provider.name !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing provider' }, { status: 400 });
    }

    // Check if user has enough credits (arbitrary minimum for now)
    if (user.credits <= 0) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }

    // Use server-managed OpenRouter API key
    const userApiKey = process.env.OPENROUTER_API_KEY;
    if (!userApiKey) {
      return NextResponse.json({ error: 'Server OpenRouter API key not configured.' }, { status: 500 });
    }

    // Model price per token
    const pricePerToken = MODEL_PRICES[model] || 0.00001;

    // Create a ReadableStream
    let totalTokensUsed = 0;
    let openrouterResponseMeta: any = null;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userApiKey}`,
              'HTTP-Referer': request.headers.get('referer') || 'https://geminicoder.com',
              'X-Title': 'GeminiCoder',
            },
            body: JSON.stringify({
              model: 'deepseek/deepseek-chat-v3-0324:free',
              temperature: 0.1,
              messages: [
                {
                  role: 'system',
                  content: 'You are a senior software principal architect, you should help the user analyse the user query and enrich it with the necessary context and constraints to make it more specific, actionable, and effective. You should also ensure that the prompt is self-contained and uses professional language. Your response should ONLY contain the enhanced prompt text. Do not include any explanations, metadata, or wrapper tags.'
                },
                {
                  role: 'user',
                  content: `[Model: ${model}]\n\n[Provider: ${typeof provider === 'string' ? provider : provider.name}]\n\n` +
                    `You are a professional prompt engineer specializing in crafting precise, effective prompts.\nYour task is to enhance prompts by making them more specific, actionable, and effective.\n\nI want you to improve the user prompt that is wrapped in <original_prompt> tags.\n\nFor valid prompts:\n- Make instructions explicit and unambiguous\n- Add relevant context and constraints\n- Remove redundant information\n- Maintain the core intent\n- Ensure the prompt is self-contained\n- Use professional language\n\nFor invalid or unclear prompts:\n- Respond with clear, professional guidance\n- Keep responses concise and actionable\n- Maintain a helpful, constructive tone\n- Focus on what the user should provide\n- Use a standard template for consistency\n\nIMPORTANT: Your response must ONLY contain the enhanced prompt text.\nDo not include any explanations, metadata, or wrapper tags.\n\n<original_prompt>\n  ${message}\n</original_prompt>`
                }
              ],
              stream: true
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
          }

          // Parse OpenRouter response headers for token usage metadata if available
          const metaHeader = response.headers.get('openrouter-processing-ms') || response.headers.get('x-openai-meta');
          if (metaHeader) {
            try {
              openrouterResponseMeta = JSON.parse(metaHeader);
              totalTokensUsed = openrouterResponseMeta.total_tokens || 0;
            } catch {}
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('Failed to get reader from response');
          }

          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (error) {
          console.error('Error in enhancer stream:', error);
          controller.error(error);
        } finally {
          controller.close();
          // Deduct credits here
          if (!totalTokensUsed) {
            totalTokensUsed = 100;
          }
          const cost = totalTokensUsed * pricePerToken;
          console.log('[CREDIT DEDUCTION DEBUG] ==========================================');
          console.log('[CREDIT DEDUCTION DEBUG] User ID:', user.id);
          console.log('[CREDIT DEDUCTION DEBUG] User email:', user.email);
          console.log('[CREDIT DEDUCTION DEBUG] Credits BEFORE deduction:', user.credits);
          console.log('[CREDIT DEDUCTION DEBUG] Model used:', model);
          console.log('[CREDIT DEDUCTION DEBUG] Total tokens used:', totalTokensUsed);
          console.log('[CREDIT DEDUCTION DEBUG] Price per token:', pricePerToken);
          console.log('[CREDIT DEDUCTION DEBUG] Cost to deduct:', cost);
          try {
            const updateResult = await db.user.update({
              where: { id: user.id },
              data: { credits: { decrement: cost } },
            });
            console.log('[CREDIT DEDUCTION DEBUG] Credits AFTER deduction:', updateResult.credits);
            console.log('[CREDIT DEDUCTION DEBUG] db.user.update result:', updateResult);
            console.log('[CREDIT DEDUCTION DEBUG] ==========================================');
          } catch (deductError) {
            console.error('[CREDIT DEDUCTION DEBUG] Error updating user credits:', deductError);
            console.log('[CREDIT DEDUCTION DEBUG] ==========================================');
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in enhancer API:', error);
    if (error instanceof Error && error.message?.includes('API key')) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
