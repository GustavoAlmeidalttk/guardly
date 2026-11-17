import { useEffect, useState } from 'react';
import Feedback from './Feedback.jsx';
import ResultBadge from './ResultBadge.jsx';

function dateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function Evidence({ value }) {
  if (!value) return <span>Nenhuma evidência registrada.</span>;
  if (/^https?:\/\/\S+$/.test(value)) return <a href={value} target="_blank" rel="noopener noreferrer">Abrir evidência ↗</a>;
  return <span className="evidence-text">{value}</span>;
}

export default function ExecutionHistory({ cenario, onLoad }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    onLoad(cenario.id)
      .then((data) => { if (active) setHistorico(data); })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cenario.id, reload]);

  return (
    <div className="execution-history">
      <div className="history-heading"><div><span className="eyebrow">REGISTROS ANTERIORES</span><h4>Histórico de Execuções</h4></div><button type="button" className="text-button" onClick={() => setReload((value) => value + 1)}>Atualizar</button></div>
      {loading && <p className="muted-note">Carregando histórico…</p>}
      <Feedback type="error">{error}</Feedback>
      {!loading && !error && historico.length === 0 && <p className="muted-note">Este cenário ainda não possui histórico de execuções.</p>}
      {!loading && !error && historico.map((execucao) => <article className="history-item" key={execucao.id}><div className="history-item-top"><ResultBadge resultado={execucao.resultado} /><time dateTime={execucao.finalizadoEm}>{dateTime(execucao.finalizadoEm)}</time></div><div className="history-item-details"><div><span>RESPONSÁVEL</span><strong>{execucao.responsavel}</strong></div><div><span>EVIDÊNCIAS</span><Evidence value={execucao.evidencias} /></div></div></article>)}
    </div>
  );
}
