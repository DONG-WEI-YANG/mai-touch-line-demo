/**
 * NLP module — wraps engine for app-context consumption.
 */
export type { NLPResult } from "./engine";
export type { RoutingSuggestion } from "./voice-router";
import { processText, type NLPResult } from "./engine";

export async function analyzeMessage(text: string): Promise<{ nlpResult: NLPResult }> {
  const nlpResult = processText(text);
  return { nlpResult };
}
