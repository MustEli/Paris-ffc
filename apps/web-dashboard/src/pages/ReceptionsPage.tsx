import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { ApiError } from '../core/api/client';
import {
  addInstructions,
  bulkAddInstructions,
  CATEGORY_LABELS,
  fetchReceptions,
  summarizeDetails,
  type BulkInstructionResult,
  type Reception,
} from '../core/api/receptions';
import { useAuth } from '../core/auth/AuthContext';

interface TemplateRow {
  'Reception ID': string;
  Category: string;
  'Arrived At': string;
  Summary: string;
  Instructions: string;
}

function toTemplateRow(r: Reception): TemplateRow {
  return {
    'Reception ID': r.id,
    Category: CATEGORY_LABELS[r.details.category],
    'Arrived At': new Date(r.arrivedAt).toLocaleString(),
    Summary: summarizeDetails(r),
    Instructions: '',
  };
}

function downloadTemplate(pending: Reception[]) {
  const rows = pending.map(toTemplateRow);
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 20 }, { wch: 32 }, { wch: 40 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Instructions');
  XLSX.writeFile(book, `elno-instructions-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function parseUploadedFile(file: File): Promise<{ id: string; instructions: string }[]> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Partial<TemplateRow>>(sheet);

  return rows
    .filter((row) => row['Reception ID'] && row.Instructions && row.Instructions.trim())
    .map((row) => ({ id: String(row['Reception ID']), instructions: String(row.Instructions).trim() }));
}

/**
 * Two ways to give instructions: a quick inline one-at-a-time box per
 * row for a single reception, and the "download template → fill in
 * Excel → re-upload → preview → confirm" flow below for doing many at
 * once. Both end up calling the same backend logic (addInstructions /
 * bulkAddInstructions), just batched differently.
 */
export function ReceptionsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['receptions'],
    queryFn: () => fetchReceptions(token!),
    enabled: !!token,
  });

  const [preview, setPreview] = useState<{ id: string; instructions: string }[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkInstructionResult[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pending = (data ?? []).filter((r) => r.status === 'arrived');
  const receptionById = new Map((data ?? []).map((r) => [r.id, r]));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['receptions'] });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setParseError(null);
    setResults(null);
    try {
      const rows = await parseUploadedFile(file);
      if (rows.length === 0) {
        setParseError('No rows with an Instructions value were found in that file.');
        setPreview(null);
        return;
      }
      setPreview(rows);
    } catch {
      setParseError('Could not read that file — make sure it is the .xlsx template, unedited in structure.');
      setPreview(null);
    }
  }

  async function handleConfirmSubmit() {
    if (!preview) return;
    setIsSubmitting(true);
    try {
      const outcome = await bulkAddInstructions(token!, preview);
      setResults(outcome);
      setPreview(null);
      refresh();
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : 'Bulk submit failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Reception Instructions</h1>
      <p className="page-subtitle">
        Give instructions one at a time below, or handle many at once with the Excel template.
      </p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      <div className="card">
        <div className="section-toolbar">
          <h2 style={{ margin: 0 }}>Bulk instructions via Excel</h2>
        </div>
        <div className="flex-row" style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" onClick={() => downloadTemplate(pending)} disabled={pending.length === 0}>
            Download Instructions Template ({pending.length} pending)
          </button>
          <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => fileInputRef.current?.click()}>
            Upload Filled Template
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleFileSelected} />
        </div>
        {parseError && <p className="error-text">{parseError}</p>}

        {preview && (
          <div style={{ marginTop: 16 }}>
            <h2>Preview — {preview.length} row(s) will be updated</h2>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Summary</th>
                  <th>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const reception = receptionById.get(row.id);
                  return (
                    <tr key={row.id}>
                      <td>{reception ? CATEGORY_LABELS[reception.details.category] : '(unknown reception)'}</td>
                      <td>{reception ? summarizeDetails(reception) : row.id}</td>
                      <td>{row.instructions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleConfirmSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : `Confirm and apply ${preview.length} instruction(s)`}
              </button>
              <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {results && (
          <div style={{ marginTop: 16 }}>
            <h2>Result</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {results.map((r) => (
                <li key={r.id} style={{ color: r.success ? '#15803d' : '#dc2626' }}>
                  {r.success ? 'Applied' : `Failed: ${r.error}`} — {receptionById.get(r.id) ? summarizeDetails(receptionById.get(r.id)!) : r.id}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <h2>Pending instructions ({pending.length})</h2>
      <div className="card">
        {pending.length === 0 && <p className="hint-text">Nothing waiting on instructions right now.</p>}
        {pending.map((reception) => (
          <PendingReceptionRow key={reception.id} reception={reception} onDone={refresh} />
        ))}
      </div>
    </div>
  );
}

function PendingReceptionRow({ reception, onDone }: { reception: Reception; onDone: () => void }) {
  const { token } = useAuth();
  const [draft, setDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!draft.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await addInstructions(token!, reception.id, draft.trim());
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send instructions');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{CATEGORY_LABELS[reception.details.category]}</div>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{summarizeDetails(reception)}</div>
      <div className="flex-row">
        <input
          type="text"
          placeholder="e.g. Stack in aisle 4, bay 2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isSubmitting}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={isSubmitting || !draft.trim()}>
          Send
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
