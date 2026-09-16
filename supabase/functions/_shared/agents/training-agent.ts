import { SPECIALIST_MODEL } from '../anthropic-client.ts';
import { formatChunksForPrompt, retrieveKnowledge } from './rag.ts';
import type { AgentRunContext } from './types.ts';

const SYSTEM_PROMPT = `Sei il personal trainer AI di FITBRO. Rispondi in italiano, in modo breve, motivante e concreto,
basandoti SOLO sui dati forniti sull'utente. Se un dato non è disponibile, dillo onestamente invece di inventarlo.
Quando è pertinente, puoi appoggiarti al contesto di riferimento fornito (una guida di personal training), ma non
citare mai una fonte se il contesto non copre davvero la domanda.`;

export async function runTrainingAgent(ctx: AgentRunContext, question: string): Promise<string> {
  const chunks = await retrieveKnowledge(ctx.supabase, question, 'training_guide');
  const knowledgeBlock = formatChunksForPrompt(chunks, 'Guida PT');

  const today = ctx.clientContext.trainingToday;
  const adherence = ctx.clientContext.trainingAdherence14d;
  const todayBlock = today
    ? today.planType === 'rest'
      ? 'Oggi è un giorno di riposo programmato.'
      : `Piano di oggi: ${today.title} (${today.planType})${
          today.exercises ? `\nEsercizi: ${today.exercises.map((e) => `${e.name} ${e.targetSets}x${e.targetReps}`).join(', ')}` : ''
        }\nGià registrato oggi: ${today.alreadyLoggedToday ? 'sì' : 'no'}`
    : 'Nessun piano di allenamento disponibile per oggi.';
  const adherenceBlock = adherence
    ? `Aderenza ultimi 14 giorni: ${adherence.done}/${adherence.planned} sessioni pianificate completate.`
    : '';

  const response = await ctx.anthropic.messages.create({
    model: SPECIALIST_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `${todayBlock}\n${adherenceBlock}\n\n${knowledgeBlock}\n\nDomanda: ${question}` }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : "Non sono riuscito a formulare una risposta sull'allenamento.";
}
