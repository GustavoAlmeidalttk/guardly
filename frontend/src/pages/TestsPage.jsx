import TestForm from '../components/TestForm.jsx';

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export default function TestsPage({ testes, loading, error, onSave, onSelect, onRetry }) {
  return (
    <div className="page-grid">
      <section className="panel list-panel" aria-labelledby="tests-title">
        <div className="panel-heading"><div><span className="eyebrow">BIBLIOTECA</span><h2 id="tests-title">Testes cadastrados</h2></div><span className="count-badge">{testes.length}</span></div>
        {loading && <p className="state-message">Carregando testes…</p>}
        {error && <div className="feedback feedback-error" role="alert">{error} <button className="text-button" onClick={onRetry}>Tentar novamente</button></div>}
        {!loading && !error && testes.length === 0 && <div className="empty-state"><div className="empty-icon">◇</div><h3>Nenhum teste ainda</h3><p>Cadastre o primeiro teste para começar a organizar seus cenários.</p></div>}
        {!loading && !error && testes.length > 0 && <div className="test-list">{testes.map((teste) => (
          <button className="test-card" key={teste.id} onClick={() => onSelect(teste)}>
            <span className="test-card-top"><span className="type-pill">TESTE</span><span className="card-arrow">↗</span></span>
            <strong>{teste.nome}</strong>
            <span className="test-description">{teste.descricao || 'Sem descrição'}</span>
            <span className="test-card-bottom"><span>{teste._count?.cenarios ?? 0} cenários</span><span>{formatDate(teste.createdAt)}</span></span>
          </button>
        ))}</div>}
      </section>
      <section className="panel form-panel" aria-labelledby="create-test-title">
        <div className="panel-heading"><div><span className="eyebrow">NOVO REGISTRO</span><h2 id="create-test-title">Cadastrar teste</h2></div><span className="panel-icon">＋</span></div>
        <p className="panel-intro">Defina o objetivo e os passos. Depois, adicione cenários específicos ao teste.</p>
        <TestForm onSave={onSave} />
      </section>
    </div>
  );
}
