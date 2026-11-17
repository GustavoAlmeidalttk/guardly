export default function CodeInput({ value, onChange }) {
  return <div className="field code-field"><label htmlFor="security-code">Código para análise <span className="required">*</span></label><textarea id="security-code" value={value} onChange={(event) => onChange(event.target.value)} rows={15} spellCheck={false} placeholder={'// Cole aqui um trecho de JavaScript\nconst valor = req.query.valor;'} aria-describedby="code-help" /><p id="code-help">Até 50 KB. O trecho é analisado como texto e não é armazenado pelo Guardly.</p></div>;
}
