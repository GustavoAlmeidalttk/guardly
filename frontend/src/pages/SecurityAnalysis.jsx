import { useState } from 'react';
import CodeInput from '../components/security/CodeInput.jsx';
import AnalysisResult from '../components/security/AnalysisResult.jsx';
import Feedback from '../components/Feedback.jsx';
import { api } from '../services/api.js';

export default function SecurityAnalysis() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [generatedByAI, setGeneratedByAI] = useState(false);
  const [aiTool, setAiTool] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!code.trim()) { setError('Insira um código para análise.'); setReport(null); return; }
    if (new Blob([code]).size > 50_000) { setError('O código deve ter no máximo 50 KB.'); setReport(null); return; }
    setLoading(true);
    setError('');
    setReport(null);
    try {
      setReport(await api.analisarCodigo({ code, language, generatedByAI, aiTool: generatedByAI ? aiTool.trim() : '' }));
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }

  return <div className="security-page"><div className="page-heading"><div><span className="eyebrow eyebrow-blue">WORKSPACE / SEGURANÇA</span><h1>Análise de código<span className="heading-dot">.</span></h1><p>Investigue riscos conhecidos em trechos de JavaScript antes de incorporá-los ao projeto.</p></div><div className="heading-accent" aria-hidden="true"><span>03</span><i /></div></div><div className="security-grid"><section className="panel security-input-panel" aria-labelledby="security-form-title"><div className="panel-heading"><div><span className="eyebrow">ANÁLISE ESTÁTICA</span><h2 id="security-form-title">Enviar código</h2></div><span className="panel-icon">⌕</span></div><form className="entry-form security-form" onSubmit={submit} noValidate><CodeInput value={code} onChange={(value) => { setCode(value); setError(''); setReport(null); }} /><div className="field"><label htmlFor="security-language">Linguagem</label><select id="security-language" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="javascript">JavaScript</option></select></div><label className="ai-checkbox"><input type="checkbox" checked={generatedByAI} onChange={(event) => setGeneratedByAI(event.target.checked)} /> Código gerado por inteligência artificial</label>{generatedByAI && <div className="field"><label htmlFor="ai-tool">Ferramenta de IA (opcional)</label><input id="ai-tool" value={aiTool} onChange={(event) => setAiTool(event.target.value)} maxLength={100} placeholder="Ex.: ChatGPT" /></div>}<Feedback type="error">{error}</Feedback><button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Analisando…' : 'Analisar código'}</button>{loading && <p className="analysis-loading" role="status">Analisando o trecho com regras estáticas de segurança…</p>}</form></section><aside className="security-guide"><span className="eyebrow">COMO FUNCIONA</span><h2>Revise antes de integrar.</h2><p>O analisador verifica padrões conhecidos no texto enviado e mostra a localização das ocorrências. Ele não executa o código.</p><div className="guide-steps"><div><span>01</span><p>Cole um trecho de JavaScript.</p></div><div><span>02</span><p>Confira os riscos e as linhas indicadas.</p></div><div><span>03</span><p>Exporte o relatório para revisão.</p></div></div><p className="guide-note">Nenhuma ocorrência significa apenas que as regras configuradas não identificaram riscos conhecidos.</p></aside></div>{report && <AnalysisResult report={report} />}</div>;
}
