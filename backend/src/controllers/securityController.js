import { analyzeCode } from '../services/securityAnalysisService.js';

export async function analyze(req, res) {
  res.json(await analyzeCode(req.analysisInput));
}
