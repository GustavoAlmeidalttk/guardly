export default function Field({ label, name, value, onChange, required = false, multiline = false, placeholder = '', rows = 3 }) {
  const id = `field-${name}`;
  const props = { id, name, value, onChange: (event) => onChange(name, event.target.value), placeholder, required };
  return (
    <div className="field">
      <label htmlFor={id}>{label}{required && <span className="required"> *</span>}</label>
      {multiline ? <textarea {...props} rows={rows} /> : <input {...props} type="text" />}
    </div>
  );
}
