import { useState } from 'react';
import ScenarioForm from '../components/ScenarioForm.jsx';
import ExecutionWorkspace from '../components/ExecutionWorkspace.jsx';
import ExecutionHistory from '../components/ExecutionHistory.jsx';
import ResultBadge from '../components/ResultBadge.jsx';

function dateText(date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(date));
}

export default function TestDetailPage({ teste, cenarios, loading, error, onBack, onSave, onRetry, onStartExecution, onFinishExecution, onLoadHistory }) {
  const [active, setActive] = useState(null);
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
              <div className="scenario-heading"><span className="scenario-index">{String(cenarios.length - index).padStart(2, '0')}</span><div><h3>{cenario.nome}</h3><span className="scenario-date">{dateText(cenario.createdAt)}</span></div></div>
              <div className="scenario-result"><span>ÚLTIMO RESULTADO</span><ResultBadge resultado={cenario.ultimoResultado} /></div>
              {cenario.descricao && <p className="scenario-description">{cenario.descricao}</p>}
              <div className="scenario-fields"><div><span>PRÉ-CONDIÇÕES</span><p>{cenario.preCondicoes || '—'}</p></div><div><span>PASSOS</span><p>{cenario.passos || '—'}</p></div><div><span>RESULTADO ESPERADO</span><p>{cenario.resultadoEsperado || '—'}</p></div></div>
              <div className="scenario-actions"><button type="button" className="button button-primary" aria-pressed={active?.id === cenario.id && active.tab === 'execute'} onClick={() => setActive({ id: cenario.id, tab: 'execute' })}>Executar cenário</button><button type="button" className="button button-secondary" aria-pressed={active?.id === cenario.id && active.tab === 'history'} onClick={() => setActive({ id: cenario.id, tab: 'history' })}>Histórico de Execuções</button></div>
              {active?.id === cenario.id && <div className="scenario-workspace" key={`${cenario.id}-${active.tab}`}>{active.tab === 'execute'
                ? <ExecutionWorkspace cenario={cenario} onStart={onStartExecution} onFinish={onFinishExecution} onViewHistory={() => setActive({ id: cenario.id, tab: 'history' })} />
                : <ExecutionHistory cenario={cenario} onLoad={onLoadHistory} />}</div>}
            </article>
          ))}</div>}
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
