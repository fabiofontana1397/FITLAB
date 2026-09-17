import { SPECIALIST_MODEL } from '../anthropic-client.ts';
import { formatChunksForPrompt, retrieveKnowledge } from './rag.ts';
import type { AgentRunContext } from './types.ts';

const SYSTEM_PROMPT = `Sei il nutrizionista AI di FITLAB. Rispondi in italiano, in modo breve, concreto e amichevole,
basandoti SOLO sui dati forniti sull'utente. Se un dato non è disponibile, dillo onestamente invece di inventarlo.
Quando è pertinente, puoi appoggiarti al contesto di riferimento fornito (una guida nutrizionale), ma non citare
mai una fonte se il contesto non copre davvero la domanda.`;

export async function runNutritionAgent(ctx: AgentRunContext, question: string): Promise<string> {
  const chunks = await retrieveKnowledge(ctx.supabase, question, 'nutrition_guide');
  const knowledgeBlock = formatChunksForPrompt(chunks, 'Guida Dieta');

  const nutrition = ctx.clientContext.nutritionToday;
  const dataBlock = nutrition
    ? `Dati odierni dell'utente:
- Calorie: ${nutrition.kcalEaten}/${nutrition.kcalTarget} kcal
- Proteine: ${nutrition.proteinEatenG}/${nutrition.proteinTargetG} g
- Carboidrati: ${nutrition.carbsEatenG} g, Grassi: ${nutrition.fatsEatenG} g
- Giorni consecutivi di logging: ${nutrition.loggingStreakDays}`
    : `Nessun dato nutrizionale disponibile per oggi.`;

  const response = await ctx.anthropic.messages.create({
    model: SPECIALIST_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${dataBlock}\n\n${knowledgeBlock}\n\nDomanda: ${question}` }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : 'Non sono riuscito a formulare una risposta sulla nutrizione.';
}
