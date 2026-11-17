import { randomUUID } from 'node:crypto';
import { runStaticAnalyzer } from '../analyzers/analyzerAdapter.js';
import { normalizeFindings } from '../analyzers/resultNormalizer.js';
import { HttpError } from '../middlewares/errors.js';

let activeAnalyses = 0;
const MAX_CONCURRENT_ANALYSES = 2;

export async function analyzeCode(input) {
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    throw new HttpError(429, 'ANALYZER_BUSY', 'A análise está ocupada. Tente novamente em instantes.');
  }
  activeAnalyses += 1;
  try {
    const messages = await runStaticAnalyzer(input.code);
    const risks = normalizeFindings(messages);
    return {
      analysisId: randomUUID(),
      analyzedAt: new Date().toISOString(),
      language: input.language,
      generatedByAI: input.generatedByAI,
      aiTool: input.aiTool || null,
      analyzer: 'ESLint + eslint-plugin-security',
      status: risks.length ? 'risks_found' : 'no_findings',
      message: risks.length ? `${risks.length} possível(is) risco(s) identificado(s).` : 'Nenhum risco encontrado.',
      risks
    };
  } finally {
    activeAnalyses -= 1;
  }
}
