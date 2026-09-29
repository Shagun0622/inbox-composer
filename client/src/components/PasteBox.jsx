import { useState } from 'react';
import { parsePaste } from '../api.js';

export default function PasteBox({ onParsed, onError, error }) {
  const [permalink, setPermalink] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pastedText.trim()) return;

    setLoading(true);
    try {
      const { status, data } = await parsePaste({ permalink, pastedText });
      if (status >= 400 || !data.ok) {
        onError(data.message || 'Could not parse that paste.');
      } else {
        onParsed({
          draft: data.draft,
          issues: data.issues || [],
          warnings: data.warnings || [],
          verdict: data.verdict,
        });
      }
    } catch (err) {
      onError('Network error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Paste a chat permalink</h2>

      <label>
        Permalink (optional)
        <input
          type="text"
          value={permalink}
          onChange={e => setPermalink(e.target.value)}
          placeholder="https://slack.example.com/archives/C0123/p1690000000000000"
        />
      </label>

      <label>
        Pasted chat text
        <textarea
          rows={12}
          value={pastedText}
          onChange={e => setPastedText(e.target.value)}
          placeholder={'From: dana@northwind.example\nTo: kit@studio.example\nDate: 2026-09-20 10:00\n\nNorthwind invoice sync kickoff\nDana: Let\'s review.'}
          required
        />
      </label>

      {error && <div className="error">{error}</div>}

      <button type="submit" disabled={loading || !pastedText.trim()}>
        {loading ? 'Parsing…' : 'Parse'}
      </button>
    </form>
  );
}