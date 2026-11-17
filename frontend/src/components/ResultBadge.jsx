const labels = { aprovado: 'Aprovado', reprovado: 'Reprovado', bloqueado: 'Bloqueado' };

export default function ResultBadge({ resultado }) {
  if (!resultado) return <span className="result-badge result-none">Ainda não executado</span>;
  return <span className={`result-badge result-${resultado}`}>{labels[resultado] || resultado}</span>;
}
