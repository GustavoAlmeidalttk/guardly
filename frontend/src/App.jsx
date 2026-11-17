import { useEffect, useState } from 'react';
import TestsPage from './pages/TestsPage.jsx';
import TestDetailPage from './pages/TestDetailPage.jsx';
import SecurityAnalysis from './pages/SecurityAnalysis.jsx';
import { api } from './services/api.js';
import { useDocumentTitle } from './hooks/useDocumentTitle.js';

export default function App() {
  const [testes, setTestes] = useState([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [testsError, setTestsError] = useState('');
  const [selected, setSelected] = useState(null);
  const [cenarios, setCenarios] = useState([]);
  const [scenariosLoading, setScenariosLoading] = useState(false);
  const [scenariosError, setScenariosError] = useState('');
  const [reloadTests, setReloadTests] = useState(0);
  const [reloadScenarios, setReloadScenarios] = useState(0);
  const [section, setSection] = useState('tests');
  useDocumentTitle(section === 'security' ? 'Análise de segurança' : selected ? selected.nome : 'Gerenciador de testes');

  useEffect(() => {
    let active = true;
    setTestsLoading(true);
    setTestsError('');
    api.listarTestes()
      .then((data) => { if (active) setTestes(data); })
      .catch((error) => { if (active) setTestsError(error.message); })
      .finally(() => { if (active) setTestsLoading(false); });
    return () => { active = false; };
  }, [reloadTests]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setScenariosLoading(true);
    setScenariosError('');
    api.listarCenarios(selected.id)
      .then((data) => { if (active) setCenarios(data); })
      .catch((error) => { if (active) setScenariosError(error.message); })
      .finally(() => { if (active) setScenariosLoading(false); });
    return () => { active = false; };
  }, [selected, reloadScenarios]);

  async function saveTeste(data) {
    const created = await api.criarTeste(data);
    setTestes((current) => [{ ...created, _count: { cenarios: 0 } }, ...current]);
  }

  async function saveCenario(data) {
    const created = await api.criarCenario(selected.id, data);
    setCenarios((current) => [created, ...current]);
    setTestes((current) => current.map((teste) => teste.id === selected.id
      ? { ...teste, _count: { cenarios: (teste._count?.cenarios ?? 0) + 1 } }
      : teste));
  }

  async function startExecution(scenarioId) {
    return api.iniciarExecucao(selected.id, scenarioId);
  }

  async function finishExecution(scenarioId, executionId, data) {
    const finished = await api.finalizarExecucao(selected.id, scenarioId, executionId, data);
    setCenarios((current) => current.map((cenario) => cenario.id === scenarioId
      ? { ...cenario, ultimoResultado: finished.resultado, ultimaExecucaoEm: finished.finalizadoEm }
      : cenario));
    return finished;
  }

  async function loadHistory(scenarioId) {
    return api.listarExecucoes(selected.id, scenarioId);
  }

  function selectTeste(teste) {
    setCenarios([]);
    setSelected(teste);
  }

  return (
    <div className="app-shell">
      <header className="site-header"><div className="header-inner">
        <button className="brand" onClick={() => { setSection('tests'); setSelected(null); }} aria-label="Guardly, voltar para testes"><span className="brand-mark">G<span>·</span></span><span>guardly</span></button>
        <span className="header-divider" aria-hidden="true" />
        <span className="header-product">Gerenciador de testes</span>
        <nav className="header-nav" aria-label="Navegação principal"><button type="button" className={section === 'tests' ? 'nav-active' : ''} onClick={() => setSection('tests')}>Testes</button><button type="button" className={section === 'security' ? 'nav-active' : ''} onClick={() => setSection('security')}>Análise de segurança</button></nav>
      </div></header>
      <main className="main-content">
        {section === 'security' ? <SecurityAnalysis /> : !selected ? (
          <>
            <div className="page-heading"><div><span className="eyebrow eyebrow-blue">WORKSPACE / TESTES</span><h1>Organize seus testes<span className="heading-dot">.</span></h1><p>Cadastre testes, documente cenários e mantenha tudo em um só lugar.</p></div><div className="heading-accent" aria-hidden="true"><span>01</span><i /></div></div>
            <TestsPage testes={testes} loading={testsLoading} error={testsError} onSave={saveTeste} onSelect={selectTeste} onRetry={() => setReloadTests((n) => n + 1)} />
          </>
        ) : (
          <TestDetailPage teste={selected} cenarios={cenarios} loading={scenariosLoading} error={scenariosError} onBack={() => setSelected(null)} onSave={saveCenario} onRetry={() => setReloadScenarios((n) => n + 1)} onStartExecution={startExecution} onFinishExecution={finishExecution} onLoadHistory={loadHistory} />
        )}
      </main>
      <footer className="site-footer"><span>GUARDLY / TEST MANAGEMENT</span><span>Estrutura para testes de software e segurança</span></footer>
    </div>
  );
}
