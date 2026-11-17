import { useState } from 'react';
import Feedback from './Feedback.jsx';
import ResultBadge from './ResultBadge.jsx';

const results = [
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'reprovado', label: 'Reprovado' },
  { value: 'bloqueado', label: 'Bloqueado' }
];

export default function ExecutionWorkspace({ cenario, onStart, onFinish, onViewHistory }) {
  const [execucao, setExecucao] = useState(null);
  const [checkedSteps, setCheckedSteps] = useState([]);
  const [resultado, setResultado] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [evidencias, setEvidencias] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [finishedResult, setFinishedResult] = useState('');
  const current = execucao?.cenario || cenario;
  const steps = (current.passos || '').split(/\r?\n/).map((step) => step.trim()).filter(Boolean);

  async function start() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const started = await onStart(cenario.id);
      setExecucao(started);
      setCheckedSteps([]);
      setResultado('');
      setEvidencias('');
      setFinishedResult('');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function prepareFinish(event) {
    event.preventDefault();
    if (!resultado) { setError('Selecione o resultado da execução.'); return; }
    if (!responsavel.trim()) { setError('Informe o responsável pela execução.'); return; }
    setError('');
    setConfirming(true);
  }

  async function finish() {
    setBusy(true);
    setError('');
    try {
      const final = await onFinish(cenario.id, execucao.id, { resultado, responsavel: responsavel.trim(), evidencias: evidencias.trim() });
      setExecucao(null);
      setConfirming(false);
      setFinishedResult(final.resultado);
      setSuccess('Resultado salvo no histórico de execuções.');
    } catch (cause) {
      setConfirming(false);
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleStep(index) {
    setCheckedSteps((currentSteps) => currentSteps.includes(index)
      ? currentSteps.filter((item) => item !== index)
      : [...currentSteps, index]);
  }

  return (
    <div className="execution-workspace">
      <div className="execution-intro"><span className="eyebrow">EXECUÇÃO MANUAL</span><h4>{current.nome}</h4><p>{current.descricao || 'Sem descrição cadastrada.'}</p></div>
      <div className="execution-context"><div><span>PRÉ-CONDIÇÕES</span><p>{current.preCondicoes || 'Nenhuma pré-condição cadastrada.'}</p></div><div><span>RESULTADO ESPERADO</span><p>{current.resultadoEsperado || 'Não informado.'}</p></div></div>
      <div className="execution-steps"><div className="steps-heading"><strong>Passos do cenário</strong>{execucao && <span>{checkedSteps.length}/{steps.length} acompanhados</span>}</div>
        {steps.length === 0 && <p className="muted-note">Este cenário ainda não possui passos cadastrados.</p>}
        {steps.map((step, index) => <label className="execution-step" key={`${index}-${step}`}><input type="checkbox" checked={checkedSteps.includes(index)} onChange={() => toggleStep(index)} disabled={!execucao} /><span className="step-number">{String(index + 1).padStart(2, '0')}</span><span>{step}</span></label>)}
      </div>
      <Feedback type="error">{error}</Feedback>
      <Feedback type="success">{success}</Feedback>
      {finishedResult && <div className="execution-finished">Resultado registrado: <ResultBadge resultado={finishedResult} /> <button type="button" className="text-button" onClick={onViewHistory}>Ver histórico</button></div>}
      {!execucao ? <button type="button" className="button button-primary" disabled={busy} onClick={start}>{busy ? 'Iniciando…' : finishedResult ? 'Iniciar nova execução' : 'Iniciar execução'}</button> : (
        <form className="execution-form" onSubmit={prepareFinish} noValidate>
          <div className="field"><label htmlFor="execution-owner">Responsável <span className="required">*</span></label><input id="execution-owner" value={responsavel} onChange={(event) => setResponsavel(event.target.value)} placeholder="Nome do analista" /></div>
          <fieldset className="result-fieldset"><legend>Resultado final <span className="required">*</span></legend><div className="result-options">{results.map((item) => <label key={item.value} className={`result-option result-option-${item.value}`}><input type="radio" name="resultado" value={item.value} checked={resultado === item.value} onChange={() => setResultado(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
          <div className="field"><label htmlFor="execution-evidence">Evidências</label><textarea id="execution-evidence" rows={3} value={evidencias} onChange={(event) => setEvidencias(event.target.value)} placeholder="Descrição ou link da evidência (opcional)" /></div>
          <button className="button button-primary" type="submit" disabled={busy}>Finalizar execução</button>
        </form>
      )}
      {confirming && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="finish-title" aria-describedby="finish-description"><div className="modal-icon">✓</div><h2 id="finish-title">Confirmar resultado</h2><p id="finish-description">Finalizar esta execução como <strong>{results.find((item) => item.value === resultado)?.label}</strong>? O resultado será registrado no histórico.</p><div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setConfirming(false)} disabled={busy}>Voltar</button><button type="button" className="button button-primary" onClick={finish} disabled={busy}>{busy ? 'Salvando…' : 'Confirmar e salvar'}</button></div></div></div>}
    </div>
  );
}
