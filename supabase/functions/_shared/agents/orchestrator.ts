import type Anthropic from 'npm:@anthropic-ai/sdk@^0.68';

import { ORCHESTRATOR_MODEL } from '../anthropic-client.ts';
import { runBodyProgressAgent } from './body-progress-agent.ts';
import { runNutritionAgent } from './nutrition-agent.ts';
import { runTrainingAgent } from './training-agent.ts';
import type { AgentRunContext } from './types.ts';

const ORCHESTRATOR_SYSTEM = `Sei il coach AI di FITBRO — nutrizionista e personal trainer. Rispondi sempre in italiano,
in modo amichevole, conciso e concreto.

Hai a disposizione tre specialisti da consultare tramite tool: allenamento, nutrizione, corpo/progressi. Regole:
- Per saluti o small talk, rispondi direttamente SENZA usare alcun tool.
- Consulta solo lo/gli specialista/i realmente pertinenti alla domanda dell'utente.
- Se la domanda tocca più ambiti, consulta più specialisti nella stessa richiesta (verranno eseguiti in parallelo).
- Dopo aver ricevuto le risposte degli specialisti, sintetizza UNA risposta unica e coerente in italiano — non
  concatenare semplicemente le risposte grezze, integrale in un discorso naturale.
- Ogni tool accetta solo una domanda testuale: non hai e non devi mai chiedere un identificativo utente, viene
  gestito automaticamente dal sistema.`;

// Tool schemas expose ONLY a free-text `question` — deliberately no
// user_id or any identity field. The user's identity is bound server-side
// via the JWT-scoped Postgres client already in closure (see
// _shared/supabase-client.ts), never something the model can name. Even a
// successful prompt-injection attempt has no channel to ask about another
// user's data through this interface.
const SPECIALIST_TOOLS: Anthropic.Tool[] = [
  {
    name: 'consult_training_specialist',
    description:
      "Consulta il personal trainer AI per domande su allenamento, scheda di oggi, esercizi, recupero o progressione dei carichi.",
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string', description: "La domanda specifica sull'allenamento, in italiano." } },
      required: ['question'],
    },
  },
  {
    name: 'consult_nutrition_specialist',
    description: 'Consulta il nutrizionista AI per domande su dieta, calorie, macro, pasti o alimentazione.',
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'La domanda specifica sulla nutrizione, in italiano.' } },
      required: ['question'],
    },
  },
  {
    name: 'consult_body_progress_specialist',
    description: 'Consulta lo specialista corpo/progressi per domande su peso, misure, obiettivo o andamento nel tempo.',
    input_schema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'La domanda specifica su corpo/progressi, in italiano.' } },
      required: ['question'],
    },
  },
];

async function runTool(ctx: AgentRunContext, toolUse: Anthropic.ToolUseBlock): Promise<string> {
  const question = (toolUse.input as { question?: string }).question ?? '';
  switch (toolUse.name) {
    case 'consult_training_specialist':
      return runTrainingAgent(ctx, question);
    case 'consult_nutrition_specialist':
      return runNutritionAgent(ctx, question);
    case 'consult_body_progress_specialist':
      return runBodyProgressAgent(ctx, question);
    default:
      return `Strumento sconosciuto: ${toolUse.name}`;
  }
}

function extractText(content: Anthropic.ContentBlock[]): string {
  const textBlock = content.find((b) => b.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : '';
}

const MAX_TOOL_ROUNDS = 2;

/** Manual tool-use loop (not the SDK's automatic tool runner) — each "tool
 * call" here does async Postgres I/O plus a nested Claude call, so a
 * manual loop keeps per-round cost/latency and the safety cap explicit. */
export async function runOrchestrator(ctx: AgentRunContext, userMessage: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const forceFinal = round === MAX_TOOL_ROUNDS;
    const response = await ctx.anthropic.messages.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: 1024,
      system: ORCHESTRATOR_SYSTEM,
      ...(forceFinal ? { tool_choice: { type: 'none' } } : { tools: SPECIALIST_TOOLS, tool_choice: { type: 'auto' } }),
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      return extractText(response.content) || 'Non sono riuscito a formulare una risposta, riprova.';
    }

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    // Parallel, not sequential — cuts wall-clock to the slowest specialist
    // rather than their sum. All results must return in ONE user message
    // (never split across messages), or the model is subtly trained away
    // from making parallel tool calls in future turns.
    const results = await Promise.all(toolUses.map((tu) => runTool(ctx, tu)));
    messages.push({
      role: 'user',
      content: toolUses.map((tu, i) => ({ type: 'tool_result', tool_use_id: tu.id, content: results[i] })),
    });
  }

  return 'Non sono riuscito a formulare una risposta, riprova.';
}
