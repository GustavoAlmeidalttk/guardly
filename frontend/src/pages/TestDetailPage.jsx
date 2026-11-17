import { useEffect, useState } from 'react';
import ScenarioForm from '../components/ScenarioForm.jsx';
import ExecutionWorkspace from '../components/ExecutionWorkspace.jsx';
import ExecutionHistory from '../components/ExecutionHistory.jsx';
import ResultBadge from '../components/ResultBadge.jsx';
import { api } from '../services/api.js';

const priorityLabels = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };

function dateText(date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(date));
}

export default function TestDetailPage({ teste, cenarios, loading, error, onBack, onSave, onRetry, onStartExecution, onFinishExecution, onLoadHistory }) {
  const [active, setActive] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [analysisId, setAnalysisId] = useState('');
  const [suggestionError, setSuggestionError] = useState('');
  const [suggestionBusy, setSuggestionBusy] = useState(false);
  const [riskLinks, setRiskLinks] = useState({});
  useEffect(() => { let alive = true; api.listarSugestoes(teste.id).then((items) => { if (alive) setSuggestions(items); }).catch((cause) => { if (alive) setSuggestionError(cause.message); }); return () => { alive = false; }; }, [teste.id]);
  async function generateSuggestions(event) {
    event.preventDefault(); setSuggestionBusy(true); setSuggestionError('');
    try { await api.gerarSugestoes(teste.id, analysisId.trim()); setSuggestions(await api.listarSugestoes(teste.id)); }
    catch (cause) { setSuggestionError(cause.message); }
    finally { setSuggestionBusy(false); }
  }
  async function reviewSuggestion(item, status) {
    setSuggestionBusy(true); setSuggestionError('');
    try { await api.revisarSugestao(teste.id, item.id, { status, scenario: item.scenarioDraft }); setSuggestions(await api.listarSugestoes(teste.id)); }
    catch (cause) { setSuggestionError(cause.message); }
    finally { setSuggestionBusy(false); }
  }
  return (
    <div className="detail-page">
      <button className="back-link" type="button" onClick={onBack}>← Voltar para testes</button>
      <section className="detail-hero">
        <div><span className="eyebrow">DETALHES DO TESTE</span><h1>{teste.nome}</h1><p>{teste.descricao || 'Sem descrição cadastrada.'}</p></div>
        <div className="detail-meta"><span>ID <code>{teste.id.slice(0, 8)}</code></span><span>Criado em {dateText(teste.createdAt)}</span></div>
      </section>
      {teste.passos && <section className="steps-panel"><span className="eyebrow">PASSOS DE EXECUÇÃO</span><p>{teste.passos}</p></section>}
      <div className="page-grid detail-grid">
        <section className="panel list-panel" aria-labelledby="scenarios-title">
          <div className="panel-heading"><div><span className="eyebrow">VINCULADOS A ESTE TESTE</span><h2 id="scenarios-title">Cenários</h2></div><span className="count-badge">{cenarios.length}</span></div>
          {loading && <p className="state-message">Carregando cenários…</p>}
          {error && <div className="feedback feedback-error" role="alert">{error} <button className="text-button" onClick={onRetry}>Tentar novamente</button></div>}
          {!loading && !error && cenarios.length === 0 && <div className="empty-state"><div className="empty-icon">□</div><h3>Nenhum cenário ainda</h3><p>Descreva a primeira situação que este teste deve cobrir.</p></div>}
          {!loading && !error && cenarios.length > 0 && <div className="scenario-list">{cenarios.map((cenario, index) => (
            <article className="scenario-card" key={cenario.id}>
              <div className="scenario-heading"><span className="scenario-index">{String(cenarios.length - index).padStart(2, '0')}</span><div><h3>{cenario.nome}</h3><span className="scenario-date">{dateText(cenario.createdAt)}{cenario.origemCriacao === 'sugestao_automatica' ? ' · Sugestão automática' : ''}</span></div></div>
              <div className={`risk-priority priority-${cenario.riskPriority || 'sem_avaliacao'}`} aria-label={`Prioridade de risco: ${priorityLabels[cenario.riskPriority] || 'sem avaliação'}`}><strong>Prioridade: {priorityLabels[cenario.riskPriority] || 'Sem avaliação'}</strong><span>{cenario.priorityReason || 'Vincule uma análise de risco para avaliar este cenário.'}</span></div>
              {cenario.sensitiveScenario && !cenario.riskAssessment && <div className="scenario-risk-alerts" role="status"><strong>Atenção: cenário relacionado a funcionalidade sensível sem avaliação válida.</strong><p>Vincule uma análise de segurança para revisar esse cenário.</p></div>}
              {cenario.riskAssessment?.risks?.length > 0 && <div className="scenario-risk-alerts"><strong>Riscos associados</strong>{cenario.riskAssessment.risks.map((risk) => <p key={risk.id}>{risk.severity.toUpperCase()} · {risk.type} — {risk.description}{risk.location?.line ? ` (linha ${risk.location.line})` : ''}</p>)}</div>}
              <form className="risk-link-form" onSubmit={async (event) => { event.preventDefault(); const values = riskLinks[cenario.id] || {}; setRiskLinks((current) => ({ ...current, [cenario.id]: { ...values, busy: true, error: '' } })); try { await api.associarRiscos(teste.id, cenario.id, { analysisId: values.analysisId?.trim(), riskIds: (values.riskIds || '').split(',').map((id) => id.trim()).filter(Boolean) }); setRiskLinks((current) => ({ ...current, [cenario.id]: { ...values, busy: false, error: '' } })); onRetry(); } catch (cause) { setRiskLinks((current) => ({ ...current, [cenario.id]: { ...values, busy: false, error: cause.message } })); } }}><label>Análise para vincular<input value={riskLinks[cenario.id]?.analysisId || ''} onChange={(event) => setRiskLinks((current) => ({ ...current, [cenario.id]: { ...current[cenario.id], analysisId: event.target.value } }))} placeholder="analysisId" required /></label><label>IDs dos riscos<input value={riskLinks[cenario.id]?.riskIds || ''} onChange={(event) => setRiskLinks((current) => ({ ...current, [cenario.id]: { ...current[cenario.id], riskIds: event.target.value } }))} placeholder="risk-1, risk-2" required /></label><button type="submit" className="button button-secondary" disabled={riskLinks[cenario.id]?.busy}>Associar riscos</button>{riskLinks[cenario.id]?.error && <p role="alert">{riskLinks[cenario.id].error}</p>}</form>
              <div className="scenario-result"><span>ÚLTIMO RESULTADO</span><ResultBadge resultado={cenario.ultimoResultado} /></div>
              {cenario.descricao && <p className="scenario-description">{cenario.descricao}</p>}
              <div className="scenario-fields"><div><span>PRÉ-CONDIÇÕES</span><p>{cenario.preCondicoes || '—'}</p></div><div><span>PASSOS</span><p>{cenario.passos || '—'}</p></div><div><span>RESULTADO ESPERADO</span><p>{cenario.resultadoEsperado || '—'}</p></div></div>
              <div className="scenario-actions"><button type="button" className="button button-primary" aria-pressed={active?.id === cenario.id && active.tab === 'execute'} onClick={() => setActive({ id: cenario.id, tab: 'execute' })}>Executar cenário</button><button type="button" className="button button-secondary" aria-pressed={active?.id === cenario.id && active.tab === 'history'} onClick={() => setActive({ id: cenario.id, tab: 'history' })}>Histórico de Execuções</button></div>
              {active?.id === cenario.id && <div className="scenario-workspace" key={`${cenario.id}-${active.tab}`}>{active.tab === 'execute'
                ? <ExecutionWorkspace cenario={cenario} onStart={onStartExecution} onFinish={onFinishExecution} onViewHistory={() => setActive({ id: cenario.id, tab: 'history' })} />
                : <ExecutionHistory cenario={cenario} onLoad={onLoadHistory} />}</div>}
            </article>
          ))}</div>}
          <section className="security-suggestions" aria-labelledby="security-suggestions-title"><div className="panel-heading"><div><span className="eyebrow">BASEADAS EM ANÁLISE</span><h2 id="security-suggestions-title">Sugestões de segurança</h2></div></div><form className="suggestion-generator" onSubmit={generateSuggestions}><label htmlFor="analysis-id">ID da análise de código</label><input id="analysis-id" value={analysisId} onChange={(event) => setAnalysisId(event.target.value)} placeholder="Cole o analysisId do relatório" required /><button className="button button-secondary" disabled={suggestionBusy}>{suggestionBusy ? 'Aguarde…' : 'Gerar sugestões'}</button></form>{suggestionError && <div className="feedback feedback-error" role="alert">{suggestionError}</div>}{suggestions.length === 0 && !suggestionError && <p className="muted-note">Gere sugestões a partir de uma análise que contenha riscos identificados.</p>}{suggestions.map((item) => <article className="suggestion-card" key={item.id}><span className="eyebrow">{item.risk.severity} · {item.risk.type}</span><h3>{item.scenarioDraft.nome}</h3><p>{item.risk.description}</p><label>Passos sugeridos<textarea value={item.scenarioDraft.passos} onChange={(event) => setSuggestions((all) => all.map((suggestion) => suggestion.id === item.id ? { ...suggestion, scenarioDraft: { ...suggestion.scenarioDraft, passos: event.target.value } } : suggestion))} disabled={item.status !== 'pendente'} /></label><p className="muted-note">{item.status === 'pendente' ? 'Revise os passos e aceite para criar o cenário.' : item.status === 'aceita' ? 'Aceita e vinculada ao cenário.' : 'Sugestão descartada.'}</p>{item.status === 'pendente' && <div className="scenario-actions"><button type="button" className="button button-primary" disabled={suggestionBusy} onClick={() => reviewSuggestion(item, 'aceita')}>Aceitar sugestão</button><button type="button" className="button button-secondary" disabled={suggestionBusy} onClick={() => reviewSuggestion(item, 'descartada')}>Descartar</button></div>}</article>)}</section>
        </section>
        <section className="panel form-panel" aria-labelledby="create-scenario-title">
          <div className="panel-heading"><div><span className="eyebrow">NOVO REGISTRO</span><h2 id="create-scenario-title">Cadastrar cenário</h2></div><span className="panel-icon">＋</span></div>
          <p className="panel-intro">O cenário será vinculado a <strong>{teste.nome}</strong>.</p>
          <ScenarioForm key={teste.id} onSave={onSave} />
        </section>
      </div>
    </div>
  );
}
