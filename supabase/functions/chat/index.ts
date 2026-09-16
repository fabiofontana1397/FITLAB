import { createAnthropicClient } from '../_shared/anthropic-client.ts';
import { CORS_HEADERS, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { runOrchestrator } from '../_shared/agents/orchestrator.ts';
import type { ClientContext } from '../_shared/agents/types.ts';
import { createUserScopedClient, getAuthenticatedUser } from '../_shared/supabase-client.ts';

type ChatRequestBody = { message: string; clientContext?: ClientContext };

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = createUserScopedClient(req);
    const user = await getAuthenticatedUser(supabase);

    const body = (await req.json()) as ChatRequestBody;
    const message = body.message?.trim();
    if (!message) {
      return jsonResponse({ error: 'message is required' }, { status: 400 });
    }

    // The Edge Function is the sole writer of chat_messages — the client's
    // own optimistic local bubble is never itself persisted, avoiding a
    // duplicate-write race.
    const { error: insertUserError } = await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, role: 'user', content: message });
    if (insertUserError) throw insertUserError;

    const anthropic = createAnthropicClient();
    const replyText = await runOrchestrator({ supabase, anthropic, clientContext: body.clientContext ?? {} }, message);

    const { data: assistantRow, error: insertAssistantError } = await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, role: 'assistant', content: replyText })
      .select('id, created_at')
      .single();
    if (insertAssistantError) throw insertAssistantError;

    return jsonResponse({ id: assistantRow.id, text: replyText, createdAt: assistantRow.created_at });
  } catch (err) {
    console.error('chat function error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = message === 'Unauthorized' || message.includes('Authorization') ? 401 : 500;
    return jsonResponse({ error: message }, { status, headers: CORS_HEADERS });
  }
});
