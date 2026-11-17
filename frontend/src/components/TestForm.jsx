import { useState } from 'react';
import Field from './Field.jsx';
import Feedback from './Feedback.jsx';

const initial = { nome: '', descricao: '', passos: '' };

export default function TestForm({ onSave }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const change = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(''); setSuccess(''); };

  async function submit(event) {
    event.preventDefault();
    if (!form.nome.trim()) { setError('Informe o nome do teste.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(form);
      setForm(initial);
      setSuccess('Teste cadastrado com sucesso.');
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={submit} noValidate>
      <Field label="Nome do teste" name="nome" value={form.nome} onChange={change} required placeholder="Ex.: Validação de login" />
      <Field label="Descrição" name="descricao" value={form.descricao} onChange={change} multiline placeholder="O que este teste verifica?" />
      <Field label="Passos de execução" name="passos" value={form.passos} onChange={change} multiline rows={4} placeholder="Descreva o fluxo de execução" />
      <Feedback type="error">{error}</Feedback>
      <Feedback type="success">{success}</Feedback>
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Cadastrar teste'}</button>
    </form>
  );
}
