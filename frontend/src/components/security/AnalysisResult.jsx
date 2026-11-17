import RiskCard from './RiskCard.jsx';
import { downloadAnalysis } from '../../services/securityService.js';

function dateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AnalysisResult({ report }) {
  return <section className="analysis-result" aria-labelledby="analysis-result-title"><div className="analysis-result-heading"><div><span className="eyebrow">RELATÓRIO DE ANÁLISE</span><h2 id="analysis-result-title">Resultado da análise</h2></div><button type="button" className="button button-secondary" onClick={() => downloadAnalysis(report)}>Exportar JSON</button></div><div className="analysis-summary"><span>{report.risks.length} ocorrência(s)</span><span>JavaScript</span><span>{dateTime(report.analyzedAt)}</span>{report.generatedByAI && <span>Gerado por IA{report.aiTool ? `: ${report.aiTool}` : ''}</span>}</div>{report.risks.length ? <div className="risk-list">{report.risks.map((risk, index) => <RiskCard key={`${risk.ruleId}-${risk.location?.line ?? index}-${index}`} risk={risk} index={index} />)}</div> : <div className="analysis-clean"><div className="clean-icon">✓</div><h3>Nenhum risco identificado pelas regras configuradas</h3><p>Isso não garante que o código seja seguro.</p></div>}{report.sensitiveFeatures?.length > 0 && <section className="risk-list" aria-label="Funcionalidades sensíveis"><h3>Funcionalidades sensíveis identificadas</h3>{report.sensitiveFeatures.map((feature) => <article className="risk-card" key={feature.id}><h4>{feature.name}</h4><p>{feature.description}</p><span>Linha {feature.location.line}, coluna {feature.location.column}</span></article>)}</section>}<p className="analysis-footnote">Analisador: {report.analyzer}. Os resultados exigem revisão humana.</p></section>;
}
