import { useState } from 'react';
import Field from './Field.jsx';
import Feedback from './Feedback.jsx';

const initial = { nome: '', descricao: '', preCondicoes: '', passos: '', resultadoEsperado: '' };

export default function ScenarioForm({ onSave }) {
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const change = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(''); setSuccess(''); };

  async function save(data, confirmarDuplicidade = false) {
    setSaving(true);
    setError('');
    try {
      await onSave({ ...data, confirmarDuplicidade });
      setForm(initial);
      setPending(null);
      setSuccess('Cenário cadastrado com sucesso.');
    } catch (cause) {
      if (cause.code === 'DUPLICATE_SCENARIO' && !confirmarDuplicidade) {
        setPending(data);
      } else {
        setError(cause.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!form.nome.trim()) { setError('Informe o nome do cenário.'); return; }
    setSuccess('');
    save(form);
  }

  return (
    <>
      <form className="entry-form" onSubmit={submit} noValidate>
        <Field label="Nome do cenário" name="nome" value={form.nome} onChange={change} required placeholder="Ex.: Senha incorreta" />
        <Field label="Descrição" name="descricao" value={form.descricao} onChange={change} multiline placeholder="O que este cenário verifica?" />
        <Field label="Pré-condições" name="preCondicoes" value={form.preCondicoes} onChange={change} multiline placeholder="Estado necessário antes do teste" />
        <Field label="Passos de execução" name="passos" value={form.passos} onChange={change} multiline rows={4} placeholder="Ações para reproduzir o cenário" />
        <Field label="Resultado esperado" name="resultadoEsperado" value={form.resultadoEsperado} onChange={change} multiline placeholder="Comportamento esperado" />
        <Feedback type="error">{error}</Feedback>
        <Feedback type="success">{success}</Feedback>
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar cenário'}</button>
      </form>
      {pending && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="duplicate-title" aria-describedby="duplicate-description">
            <div className="modal-icon">!</div>
            <h2 id="duplicate-title">Nome duplicado</h2>
            <p id="duplicate-description">Já existe um cenário chamado <strong>{pending.nome}</strong> neste teste. Deseja cadastrá-lo mesmo assim?</p>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => setPending(null)} disabled={saving}>Cancelar</button>
              <button type="button" className="button button-primary" onClick={() => save(pending, true)} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar duplicidade'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
