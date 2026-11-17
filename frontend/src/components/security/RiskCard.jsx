const severityLabels = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export default function RiskCard({ risk, index }) {
  const location = risk.location?.line
    ? `Linha ${risk.location.line}${risk.location.column ? `, coluna ${risk.location.column}` : ''}`
    : 'Localização não informada';
  return <article className="risk-card"><div className="risk-top"><span className="risk-number">{String(index + 1).padStart(2, '0')}</span><span className={`severity-badge severity-${risk.severity}`}>{severityLabels[risk.severity] || risk.severity}</span></div><h3>{risk.type}</h3><p>{risk.description}</p><div className="risk-meta"><span>{location}</span><code>{risk.ruleId}</code></div></article>;
}
