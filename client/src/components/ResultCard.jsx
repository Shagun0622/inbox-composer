export default function ResultCard({ result, onReset }) {
  const success = result.written === true;

  return (
    <div className={`card result result-${success ? 'success' : 'blocked'}`}>
      {success ? (
        <>
          <h2>✓ Written to ledger</h2>
          <p>Signal id: <code>{result.signalId}</code></p>
          <p>Every write is logged in the audit trail.</p>
        </>
      ) : (
        <>
          <h2>✗ Blocked</h2>
          <p>{result.message || result.error || 'The write was rejected.'}</p>
          {result.issues?.length > 0 && (
            <ul className="issues">
              {result.issues.map((iss, i) => (
                <li key={i} className={`issue issue-${iss.level}`}>
                  <strong>{iss.code}:</strong> {iss.message}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button onClick={onReset}>Start a new paste</button>
    </div>
  );
}