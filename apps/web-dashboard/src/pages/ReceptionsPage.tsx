import { useQuery, useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { ApiError } from '../core/api/client';
import { dispatchReceptionsAsTasks } from '../core/api/openPool';
import {
  addInstructions,
  bulkAddInstructions,
  CATEGORY_LABELS,
  deleteReception,
  deleteReceptions,
  fetchReceptions,
  STATUS_LABELS,
  summarizeDetails,
  type BulkInstructionResult,
  type Reception,
  type ReceptionCategory,
} from '../core/api/receptions';
import { useAuth } from '../core/auth/AuthContext';
import { useStaffNames } from '../core/hooks/useStaffNames';
import { DispatchTaskPanel } from '../components/DispatchTaskPanel';

type SortKey = 'arrivedAt' | 'category' | 'status';

function extensionFromUrl(url: string): string {
  const match = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.exec(url);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function receptionPhotos(r: Reception): { label: string; urls: string[] }[] {
  const groups: { label: string; urls: string[] }[] = [];
  if (r.details.category === 'equipment_other') {
    groups.push({ label: 'Equipment Photo(s)', urls: r.details.photoUrls });
  }
  if (r.details.category === 'packaging_stock' || r.details.category === 'equipment_other') {
    groups.push({ label: 'Invoice Photo(s)', urls: r.details.invoicePhotoUrls });
  }
  return groups;
}

function receptionPhotoCount(r: Reception): number {
  return receptionPhotos(r).reduce((total, g) => total + g.urls.length, 0);
}

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

function downloadReceptionsExcel(receptions: Reception[], staffName: (id: string | null) => string, filenameSuffix: string) {
  const rows = receptions.map((r) => ({
    ID: r.id,
    'Date & Time': new Date(r.arrivedAt).toLocaleString(),
    Category: CATEGORY_LABELS[r.details.category],
    Staff: staffName(r.createdByUserId),
    Summary: summarizeDetails(r),
    Status: STATUS_LABELS[r.status],
    Flagged: r.flaggedForReview ? 'Yes' : 'No',
    Instructions: r.instructions ?? '',
    'Assigned To': r.assignedToUserId ? staffName(r.assignedToUserId) : '',
    Priority: r.priority,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Deliveries');
  XLSX.writeFile(book, `elno-deliveries-${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function downloadReceptionsPhotosZip(
  receptions: Reception[],
  onProgress: (done: number, total: number) => void,
): Promise<{ entries: number }> {
  const entries: { url: string; filename: string }[] = [];
  for (const r of receptions) {
    for (const group of receptionPhotos(r)) {
      group.urls.forEach((url, i) =>
        entries.push({ url, filename: `${r.id}/${group.label.replace(/[^a-z0-9]+/gi, '-')}-${i + 1}${extensionFromUrl(url)}` }),
      );
    }
  }
  if (entries.length === 0) return { entries: 0 };

  const zip = new JSZip();
  let done = 0;
  await Promise.all(
    entries.map(async (entry) => {
      const response = await fetch(entry.url);
      if (!response.ok) throw new Error(`Failed to fetch a photo (status ${response.status})`);
      const blob = await response.blob();
      zip.file(entry.filename, blob);
      done += 1;
      onProgress(done, entries.length);
    }),
  );
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `elno-delivery-photos-${new Date().toISOString().slice(0, 10)}.zip`);
  return { entries: entries.length };
}

/**
 * The "Reception & Intake" tab's main table — every Reception, any
 * status/category, sorted newest-first by default. The old "Pending
 * Instructions" single-purpose view is folded in here as a filter
 * preset (status = Awaiting instructions) that surfaces the existing
 * Excel-bulk-instructions flow and the dispatch-as-Open-Pool-task panel
 * — both still work exactly as before, just reachable from inside the
 * bigger table instead of being the whole page.
 */
export function DeliveriesSection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const staffName = useStaffNames();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['receptions'],
    queryFn: () => fetchReceptions(token!),
    enabled: !!token,
  });
  const all = data ?? [];
  const receptionById = new Map(all.map((r) => [r.id, r]));

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<ReceptionCategory | ''>('');
  const [staffFilter, setStaffFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'arrived' | 'ready_for_putaway' | 'completed'>('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('arrivedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsReception, setDetailsReception] = useState<Reception | null>(null);
  const [galleryReception, setGalleryReception] = useState<Reception | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Excel bulk-instructions flow state
  const [preview, setPreview] = useState<{ id: string; instructions: string }[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkInstructionResult[] | null>(null);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);
  const [showNeedsInstructions, setShowNeedsInstructions] = useState(false);

  const pendingInstructions = all.filter((r) => r.status === 'arrived');

  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (categoryFilter && r.details.category !== categoryFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (flaggedOnly && !r.flaggedForReview) return false;
      if (staffFilter && staffName(r.createdByUserId).toLowerCase().indexOf(staffFilter.toLowerCase()) === -1) return false;
      if (fromDate && new Date(r.arrivedAt) < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && new Date(r.arrivedAt) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [all, categoryFilter, statusFilter, flaggedOnly, staffFilter, fromDate, toDate, staffName]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'arrivedAt') cmp = new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime();
      else if (sortKey === 'category') cmp = a.details.category.localeCompare(b.details.category);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'arrivedAt' ? 'desc' : 'asc');
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['receptions'] });
  }

  async function handleDeleteOne(id: string) {
    if (!window.confirm('Delete this delivery permanently? This cannot be undone.')) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteReception(token!, id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected delivery(ies) permanently? This cannot be undone.`)) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteReceptions(token!, [...selectedIds]);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete selected');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownloadZip(targets: Reception[]) {
    setIsZipping(true);
    setZipError(null);
    setZipProgress({ done: 0, total: 0 });
    try {
      const { entries } = await downloadReceptionsPhotosZip(targets, (done, total) => setZipProgress({ done, total }));
      if (entries === 0) setZipError('No photos found for the selected delivery(ies).');
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to build the zip file.');
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
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

  async function handleConfirmTemplateSubmit() {
    if (!preview) return;
    setIsSubmittingTemplate(true);
    try {
      const outcome = await bulkAddInstructions(token!, preview);
      setResults(outcome);
      setPreview(null);
      refresh();
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : 'Bulk submit failed');
    } finally {
      setIsSubmittingTemplate(false);
    }
  }

  const selectedReceptions = sorted.filter((r) => selectedIds.has(r.id));

  return (
    <div>
      <div className="section-toolbar">
        <h2 style={{ margin: 0 }}>Deliveries</h2>
        <button
          className="btn btn-outline"
          onClick={() => setShowNeedsInstructions((v) => !v)}
        >
          {showNeedsInstructions ? 'Hide' : 'Show'} needs-instructions tools ({pendingInstructions.length})
        </button>
      </div>

      {showNeedsInstructions && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-toolbar">
            <h2 style={{ margin: 0 }}>Bulk instructions via Excel</h2>
          </div>
          <div className="flex-row" style={{ marginBottom: 12 }}>
            <button className="btn btn-accent" onClick={() => downloadTemplate(pendingInstructions)} disabled={pendingInstructions.length === 0}>
              Download Instructions Template ({pendingInstructions.length} pending)
            </button>
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
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
                <button className="btn btn-primary" onClick={handleConfirmTemplateSubmit} disabled={isSubmittingTemplate}>
                  {isSubmittingTemplate ? 'Submitting…' : `Confirm and apply ${preview.length} instruction(s)`}
                </button>
                <button className="btn btn-outline" onClick={() => setPreview(null)}>
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

          <h2 style={{ marginTop: 20 }}>One at a time</h2>
          {pendingInstructions.length === 0 && <p className="hint-text">Nothing waiting on instructions right now.</p>}
          {pendingInstructions.map((reception) => (
            <PendingReceptionRow
              key={reception.id}
              reception={reception}
              onDone={refresh}
              selected={selectedIds.has(reception.id)}
              onToggleSelected={() => toggleSelected(reception.id)}
            />
          ))}

          <DispatchTaskPanel
            items={pendingInstructions
              .filter((r) => selectedIds.has(r.id))
              .map((r) => ({ id: r.id, label: `${CATEGORY_LABELS[r.details.category]} — ${summarizeDetails(r)}` }))}
            onDispatch={(items, targetUserId) => dispatchReceptionsAsTasks(token!, items, targetUserId)}
            onAllSucceeded={() => {
              setSelectedIds(new Set());
              refresh();
            }}
          />
        </div>
      )}

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {data && (
        <div className="card">
          <div className="flex-row" style={{ flexWrap: 'wrap', marginBottom: 12, gap: 10 }}>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ReceptionCategory | '')}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input type="text" placeholder="Filter by staff" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} />
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <label className="flex-row" style={{ alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
              Flagged only
            </label>
          </div>

          <div className="flex-row" style={{ flexWrap: 'wrap', marginBottom: 12, gap: 10 }}>
            <button
              className="btn btn-outline"
              onClick={() => setSelectedIds(new Set(sorted.map((r) => r.id)))}
            >
              Select all ({sorted.length})
            </button>
            <button className="btn btn-outline" onClick={() => setSelectedIds(new Set())}>
              Clear selection
            </button>
            <button
              className="btn-danger-text"
              onClick={handleDeleteSelected}
              disabled={isDeleting || selectedIds.size === 0}
              style={{ color: '#dc2626' }}
            >
              Delete selected ({selectedIds.size})
            </button>
            <button
              className="btn btn-outline"
              onClick={() => downloadReceptionsExcel(selectedReceptions.length > 0 ? selectedReceptions : sorted, staffName, selectedReceptions.length > 0 ? 'selected' : 'all')}
            >
              Download as Excel ({selectedReceptions.length > 0 ? selectedReceptions.length : sorted.length})
            </button>
            <button
              className="btn btn-accent"
              onClick={() => handleDownloadZip(selectedReceptions.length > 0 ? selectedReceptions : sorted)}
              disabled={isZipping}
            >
              {isZipping
                ? `Zipping ${zipProgress ? `${zipProgress.done}/${zipProgress.total}` : ''}…`
                : `Download photos as ZIP (${selectedReceptions.length > 0 ? selectedReceptions.length : sorted.length})`}
            </button>
          </div>
          {zipError && <p className="error-text">{zipError}</p>}
          {deleteError && <p className="error-text">{deleteError}</p>}

          <table>
            <thead>
              <tr>
                <th></th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('arrivedAt')}>
                  Date & Time {sortKey === 'arrivedAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('category')}>
                  Category {sortKey === 'category' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Staff</th>
                <th>Summary</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('status')}>
                  Status {sortKey === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Photos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8}>No deliveries match these filters.</td>
                </tr>
              )}
              {sorted.map((r) => {
                const photoCount = receptionPhotoCount(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                    </td>
                    <td>{new Date(r.arrivedAt).toLocaleString()}</td>
                    <td>{CATEGORY_LABELS[r.details.category]}</td>
                    <td>{staffName(r.createdByUserId)}</td>
                    <td>{summarizeDetails(r)}</td>
                    <td>
                      {STATUS_LABELS[r.status]}
                      {r.flaggedForReview && (
                        <span className="pill pill-red" style={{ marginLeft: 6 }}>
                          Flagged
                        </span>
                      )}
                    </td>
                    <td>{photoCount}</td>
                    <td>
                      <div className="flex-row">
                        <button
                          className="btn-danger-text"
                          style={{ color: 'var(--gray-950)', textDecoration: 'underline' }}
                          onClick={() => setDetailsReception(r)}
                        >
                          View details
                        </button>
                        <button
                          className="btn-danger-text"
                          style={{ color: 'var(--gray-950)', textDecoration: 'underline' }}
                          onClick={() => setGalleryReception(r)}
                          disabled={photoCount === 0}
                        >
                          Photos
                        </button>
                        <button
                          className="btn-danger-text"
                          style={{ color: '#dc2626', textDecoration: 'underline' }}
                          onClick={() => handleDeleteOne(r.id)}
                          disabled={isDeleting}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailsReception && (
        <div className="modal-overlay" onClick={() => setDetailsReception(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>{CATEGORY_LABELS[detailsReception.details.category]}</h2>
                <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{summarizeDetails(detailsReception)}</p>
              </div>
              <button className="modal-close" onClick={() => setDetailsReception(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <DetailRow label="Status" value={STATUS_LABELS[detailsReception.status]} />
            <DetailRow label="Logged by" value={staffName(detailsReception.createdByUserId)} />
            <DetailRow label="Arrived at" value={new Date(detailsReception.arrivedAt).toLocaleString()} />
            {detailsReception.details.category === 'return_parcels' && (
              <DetailRow label="Transporter company" value={detailsReception.details.transporterCompany} />
            )}
            {detailsReception.details.category === 'packaging_stock' && (
              <>
                <DetailRow label="Packaging type" value={detailsReception.details.packagingType} />
                {detailsReception.details.sellerName && <DetailRow label="Seller" value={detailsReception.details.sellerName} />}
              </>
            )}
            {detailsReception.details.category === 'equipment_other' && (
              <DetailRow label="Item description" value={detailsReception.details.itemDescription} />
            )}
            {detailsReception.instructions && <DetailRow label="Instructions" value={detailsReception.instructions} />}
            {detailsReception.assignedToUserId && (
              <>
                <DetailRow label="Assigned to" value={staffName(detailsReception.assignedToUserId)} />
                <DetailRow label="Priority" value={detailsReception.priority} />
                <DetailRow label="Assigned at" value={detailsReception.assignedAt ? new Date(detailsReception.assignedAt).toLocaleString() : '—'} />
              </>
            )}
            {detailsReception.putAwayAt && <DetailRow label="Put away at" value={new Date(detailsReception.putAwayAt).toLocaleString()} />}
            {detailsReception.processingDurationMs !== null && (
              <DetailRow label="Processing time" value={`${Math.round(detailsReception.processingDurationMs / 60_000)} min`} />
            )}
          </div>
        </div>
      )}

      {galleryReception && (
        <div className="modal-overlay" onClick={() => setGalleryReception(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>{CATEGORY_LABELS[galleryReception.details.category]}</h2>
                <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{summarizeDetails(galleryReception)}</p>
              </div>
              <button className="modal-close" onClick={() => setGalleryReception(null)} aria-label="Close">
                ✕
              </button>
            </div>
            {receptionPhotos(galleryReception).map((group) => (
              <div key={group.label}>
                <h2>
                  {group.label} ({group.urls.length})
                </h2>
                {group.urls.length === 0 ? (
                  <p className="hint-text">No photos.</p>
                ) : (
                  <div className="photo-grid">
                    {group.urls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${group.label} ${i + 1}`}
                        className="photo-thumb"
                        onClick={() => setLightboxUrl(url)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="lightbox-img" />
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      <p style={{ margin: 0 }}>{value}</p>
    </div>
  );
}

function PendingReceptionRow({
  reception,
  onDone,
  selected,
  onToggleSelected,
}: {
  reception: Reception;
  onDone: () => void;
  selected: boolean;
  onToggleSelected: () => void;
}) {
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
    <div style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--gray-100)' }}>
      <div className="flex-row" style={{ alignItems: 'center', marginBottom: 4 }}>
        <input type="checkbox" checked={selected} onChange={onToggleSelected} />
        <div style={{ fontWeight: 'var(--weight-strong)', fontSize: 'var(--text-base)' }}>{CATEGORY_LABELS[reception.details.category]}</div>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginBottom: 8 }}>{summarizeDetails(reception)}</div>
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
