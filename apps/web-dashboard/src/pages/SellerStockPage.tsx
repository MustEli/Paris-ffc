import { useQuery, useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { ArrowDown, ArrowUp, ArrowUpDown, Boxes, Download, FileArchive, Image, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';

import { ApiError } from '../core/api/client';
import { dispatchPalletsAsTasks } from '../core/api/openPool';
import {
  CONDITION_FLAG_LABELS,
  deletePallet,
  deletePallets,
  fetchPallets,
  STATUS_LABELS,
  type SellerStockPallet,
} from '../core/api/sellerStock';
import { useAuth } from '../core/auth/AuthContext';
import { DispatchTaskPanel } from '../components/DispatchTaskPanel';

type SortKey = 'createdAt' | 'sellerName' | 'weightKg';

/** Matches ReceptionsPage.tsx's own copy — kept file-local rather than shared, since neither file is meant to import from the other for one small style object. */
const filterControlStyle: React.CSSProperties = {
  appearance: 'none',
  background: '#fff',
  border: '1px solid var(--gray-200)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  fontSize: 'var(--text-sm)',
  fontFamily: 'inherit',
  color: 'var(--gray-950)',
  width: 'auto',
};

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void }) {
  return (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={onClick}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active ? dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowUpDown size={12} style={{ opacity: 0.4 }} />}
      </span>
    </th>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function extensionFromUrl(url: string): string {
  const match = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.exec(url);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

function conditionLabel(pallet: SellerStockPallet): string {
  return pallet.conditionFlags.length > 0
    ? pallet.conditionFlags.map((f) => CONDITION_FLAG_LABELS[f]).join(', ')
    : pallet.condition === 'good'
      ? 'Good Condition'
      : 'Damaged';
}

function downloadPalletsExcel(pallets: SellerStockPallet[], filenameSuffix: string) {
  const rows = pallets.map((p) => ({
    Pallet: p.palletIndex,
    'Date & Time': new Date(p.createdAt).toLocaleString(),
    'Box Number': p.boxNumber,
    Seller: p.sellerName,
    'Weight (kg)': p.weightKg,
    Overweight: p.overweightFlag ? 'Yes' : 'No',
    Condition: conditionLabel(p),
    Status: STATUS_LABELS[p.status],
    'Damage Remarks': p.damageRemarks ?? '',
    'Put-Away Location': p.putAwayLocation ?? '',
    'Put Away At': p.putAwayAt ? new Date(p.putAwayAt).toLocaleString() : '',
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Seller Stock');
  XLSX.writeFile(book, `elno-seller-stock-${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Photos already live on Cloudinary with real public URLs, so this
 * fetches them directly in the browser and zips them client-side — no
 * new backend endpoint needed. If Cloudinary's default delivery domain
 * ever stops sending permissive CORS headers, the fallback would be a
 * small backend proxy endpoint; not needed for now.
 */
export function SellerStockSection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: ['seller-stock'],
    queryFn: () => fetchPallets(token!),
    enabled: !!token,
  });

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, data]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
  const [galleryPallet, setGalleryPallet] = useState<SellerStockPallet | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [sellerFilter, setSellerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const all = data ?? [];

  const filtered = useMemo(() => {
    return all.filter((p) => {
      if (sellerFilter && p.sellerName.toLowerCase().indexOf(sellerFilter.toLowerCase()) === -1) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (fromDate && new Date(p.createdAt) < new Date(`${fromDate}T00:00:00`)) return false;
      if (toDate && new Date(p.createdAt) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [all, sellerFilter, statusFilter, fromDate, toDate]);

  const pallets = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === 'sellerName') cmp = a.sellerName.localeCompare(b.sellerName);
      else if (sortKey === 'weightKg') cmp = a.weightKg - b.weightKg;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' ? 'desc' : 'asc');
    }
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['seller-stock'] });
  }

  async function handleDeleteOne(id: string) {
    if (!window.confirm('Delete this pallet permanently? This cannot be undone.')) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePallet(token!, id);
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
    if (!window.confirm(`Delete ${selectedIds.size} selected pallet(s) permanently? This cannot be undone.`)) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deletePallets(token!, [...selectedIds]);
      setSelectedIds(new Set());
      refresh();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete selected');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownloadZip(targetPallets: SellerStockPallet[]) {
    const entries: { url: string; filename: string }[] = [];
    for (const pallet of targetPallets) {
      pallet.labelPhotoUrls.forEach((url, i) =>
        entries.push({ url, filename: `${pallet.palletIndex}/label-${i + 1}${extensionFromUrl(url)}` }),
      );
      pallet.damageEvidencePhotoUrls.forEach((url, i) =>
        entries.push({ url, filename: `${pallet.palletIndex}/damage-${i + 1}${extensionFromUrl(url)}` }),
      );
    }

    if (entries.length === 0) {
      setZipError('No photos found for the selected pallet(s).');
      return;
    }

    setIsZipping(true);
    setZipError(null);
    setZipProgress({ done: 0, total: entries.length });
    try {
      const zip = new JSZip();
      let done = 0;
      await Promise.all(
        entries.map(async (entry) => {
          const response = await fetch(entry.url);
          if (!response.ok) throw new Error(`Failed to fetch a photo (status ${response.status})`);
          const blob = await response.blob();
          zip.file(entry.filename, blob);
          done += 1;
          setZipProgress({ done, total: entries.length });
        }),
      );
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `elno-pallet-photos-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to build the zip file.');
    } finally {
      setIsZipping(false);
      setZipProgress(null);
    }
  }

  const selectedPallets = pallets.filter((p) => selectedIds.has(p.id));

  return (
    <div>
      <div className="flex-row" style={{ marginBottom: 4 }}>
        <span className="icon-badge icon-badge-sm icon-badge-purple">
          <Boxes />
        </span>
        <h2 style={{ margin: 0 }}>Seller Stock Pallets</h2>
      </div>
      <p className="page-subtitle">Every pallet received, with full details, condition, and photos.</p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {all.length > 0 && (
        <div className="card">
          <div className="flex-row" style={{ flexWrap: 'wrap', marginBottom: 14, gap: 10 }}>
            <input
              type="text"
              style={{ ...filterControlStyle, flex: '2 1 200px' }}
              placeholder="Filter by seller"
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
            />
            <select style={{ ...filterControlStyle, flex: '1 1 160px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input type="date" style={{ ...filterControlStyle, flex: '0 0 auto' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" style={{ ...filterControlStyle, flex: '0 0 auto' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="section-toolbar">
            <div className="flex-row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-outline" onClick={() => setSelectedIds(new Set(pallets.map((p) => p.id)))}>
                Select all
              </button>
              <button className="btn btn-outline" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </button>
              <button
                className="btn-danger-text"
                style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                onClick={handleDeleteSelected}
                disabled={isDeleting || selectedIds.size === 0}
              >
                <Trash2 size={13} />
                Delete selected ({selectedIds.size})
              </button>
              <button
                className="btn btn-outline"
                onClick={() => downloadPalletsExcel(selectedPallets.length > 0 ? selectedPallets : pallets, selectedPallets.length > 0 ? 'selected' : 'all')}
              >
                <Download size={14} />
                Download as Excel ({selectedPallets.length > 0 ? selectedPallets.length : pallets.length})
              </button>
            </div>
            <button
              className="btn btn-accent"
              onClick={() => handleDownloadZip(selectedPallets.length > 0 ? selectedPallets : pallets)}
              disabled={isZipping}
            >
              <FileArchive size={14} />
              {isZipping
                ? `Zipping ${zipProgress ? `${zipProgress.done}/${zipProgress.total}` : ''}…`
                : `Download photos ZIP (${selectedPallets.length > 0 ? selectedPallets.length : pallets.length})`}
            </button>
          </div>
          {zipError && <p className="error-text">{zipError}</p>}
          {deleteError && <p className="error-text">{deleteError}</p>}

          <table>
            <thead>
              <tr>
                <th></th>
                <th>Pallet</th>
                <SortHeader label="Date & Time" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggleSort('createdAt')} />
                <th>Box Number</th>
                <SortHeader label="Seller" active={sortKey === 'sellerName'} dir={sortDir} onClick={() => toggleSort('sellerName')} />
                <SortHeader label="Weight (kg)" active={sortKey === 'weightKg'} dir={sortDir} onClick={() => toggleSort('weightKg')} />
                <th>Condition</th>
                <th>Status</th>
                <th>Photos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pallets.length === 0 && (
                <tr>
                  <td colSpan={10}>No pallets match these filters.</td>
                </tr>
              )}
              {pallets.map((pallet) => {
                const photoCount = pallet.labelPhotoUrls.length + pallet.damageEvidencePhotoUrls.length;
                return (
                  <tr
                    key={pallet.id}
                    ref={pallet.id === highlightId ? highlightRef : undefined}
                    className={pallet.id === highlightId ? 'highlight-row' : undefined}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(pallet.id)}
                        onChange={() => toggle(pallet.id)}
                      />
                    </td>
                    <td>{pallet.palletIndex}</td>
                    <td>{formatDateTime(pallet.createdAt)}</td>
                    <td>{pallet.boxNumber}</td>
                    <td>{pallet.sellerName}</td>
                    <td>
                      {pallet.weightKg.toLocaleString()}
                      {pallet.overweightFlag && (
                        <span className="pill pill-amber" style={{ marginLeft: 6 }}>
                          Overweight
                        </span>
                      )}
                    </td>
                    <td>{conditionLabel(pallet)}</td>
                    <td>{STATUS_LABELS[pallet.status]}</td>
                    <td>{photoCount}</td>
                    <td>
                      <div className="flex-row">
                        <button
                          className="btn-danger-text"
                          style={{ color: 'var(--gray-950)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => setGalleryPallet(pallet)}
                          disabled={photoCount === 0}
                        >
                          <Image size={13} />
                          View photos
                        </button>
                        <button
                          className="btn-danger-text"
                          style={{ color: 'var(--gray-950)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleDownloadZip([pallet])}
                          disabled={isZipping || photoCount === 0}
                        >
                          <Download size={13} />
                          Download this one
                        </button>
                        <button
                          className="btn-danger-text"
                          style={{ color: '#dc2626', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => handleDeleteOne(pallet.id)}
                          disabled={isDeleting}
                        >
                          <Trash2 size={13} />
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

      <DispatchTaskPanel
        items={selectedPallets.map((p) => ({ id: p.id, label: `${p.palletIndex} — ${p.sellerName}` }))}
        onDispatch={(items, targetUserId) => dispatchPalletsAsTasks(token!, items, targetUserId)}
        onAllSucceeded={() => setSelectedIds(new Set())}
      />

      {galleryPallet && (
        <div className="modal-overlay" onClick={() => setGalleryPallet(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>Pallet {galleryPallet.palletIndex}</h2>
                <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{galleryPallet.sellerName}</p>
              </div>
              <button className="modal-close" onClick={() => setGalleryPallet(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <h2>Delivery Proof ({galleryPallet.labelPhotoUrls.length})</h2>
            {galleryPallet.labelPhotoUrls.length === 0 ? (
              <p className="hint-text">No photos.</p>
            ) : (
              <div className="photo-grid">
                {galleryPallet.labelPhotoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Delivery proof ${i + 1}`}
                    className="photo-thumb"
                    onClick={() => setLightboxUrl(url)}
                  />
                ))}
              </div>
            )}

            <h2>Damage Evidence ({galleryPallet.damageEvidencePhotoUrls.length})</h2>
            {galleryPallet.damageEvidencePhotoUrls.length === 0 ? (
              <p className="hint-text">No photos.</p>
            ) : (
              <div className="photo-grid">
                {galleryPallet.damageEvidencePhotoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Damage evidence ${i + 1}`}
                    className="photo-thumb"
                    onClick={() => setLightboxUrl(url)}
                  />
                ))}
              </div>
            )}
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
