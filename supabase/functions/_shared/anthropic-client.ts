// Official SDK via Deno's npm: specifier support — the low-friction,
// typed, robust option (vs. esm.sh's extra CDN-resolution risk or hand-
// rolling retries/error types over raw fetch).
import Anthropic from 'npm:@anthropic-ai/sdk@^0.68';

export function createAnthropicClient(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  return new Anthropic({ apiKey });
}

// Orchestrator needs real judgment (delegation decisions + multi-domain
// synthesis) and is called only 1-2x per turn — worth Sonnet's quality.
// Specialists are narrow, mechanical, data-grounded answers from a
// provided context slice — a good fit for Haiku's lower cost/latency.
// (Verify exact current model-id strings before deploying — these were
// current at plan time.)
export const ORCHESTRATOR_MODEL = 'claude-sonnet-5';
export const SPECIALIST_MODEL = 'claude-haiku-4-5';
export const INSIGHTS_MODEL = 'claude-sonnet-5';
