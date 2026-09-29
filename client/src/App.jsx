import { useState } from 'react';
import PasteBox from './components/PasteBox.jsx';
import PreviewCard from './components/PreviewCard.jsx';
import ResultCard from './components/ResultCard.jsx';

export default function App() {
  const [step, setStep] = useState('paste');
  const [draft, setDraft] = useState(null);
  const [issues, setIssues] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleParsed({ draft, issues, warnings, verdict }) {
    setDraft(draft);
    setIssues(issues);
    setWarnings(warnings);
    setVerdict(verdict);
    setError(null);
    setStep('preview');
  }

  function handleParseError(message) {
    setError(message);
    setStep('paste');
  }

  function handleConfirmed(res) {
    setResult(res);
    setStep('result');
  }

  function reset() {
    setStep('paste');
    setDraft(null);
    setIssues([]);
    setWarnings([]);
    setVerdict(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="app">
      <header>
        <h1>Inbox Composer</h1>
        <p className="subtitle">
          Paste a chat permalink · Preview the parsed signal · Confirm before it enters the ledger
        </p>
      </header>

      <main>
        {step === 'paste' && (
          <PasteBox onParsed={handleParsed} onError={handleParseError} error={error} />
        )}

        {step === 'preview' && draft && (
          <PreviewCard
            draft={draft}
            setDraft={setDraft}
            issues={issues}
            setIssues={setIssues}
            warnings={warnings}
            verdict={verdict}
            setVerdict={setVerdict}
            onConfirmed={handleConfirmed}
            onCancel={reset}
          />
        )}

        {step === 'result' && result && (
          <ResultCard result={result} onReset={reset} />
        )}
      </main>
    </div>
  );
}