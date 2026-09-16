import { useQuery } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { useState } from 'react';

import { fetchPallets, STATUS_LABELS, type SellerStockPallet } from '../core/api/sellerStock';
import { useAuth } from '../core/auth/AuthContext';

function extensionFromUrl(url: string): string {
  const match = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.exec(url);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

/**
 * Photos already live on Cloudinary with real public URLs, so this
 * fetches them directly in the browser and zips them client-side — no
 * new backend endpoint needed. If Cloudinary's default delivery domain
 * ever stops sending permissive CORS headers, the fallback would be a
 * small backend proxy endpoint; not needed for now.
 */
export function SellerStockPage() {
  const { token } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['seller-stock'],
    queryFn: () => fetchPallets(token!),
    enabled: !!token,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  const pallets = data ?? [];

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
      <h1>Seller Stock Photos</h1>
      <p className="page-subtitle">Select one or more pallets and download all their photos as a single zip file.</p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      {pallets.length > 0 && (
        <div className="card">
          <div className="section-toolbar">
            <div className="flex-row">
              <button
                className="btn btn-outline"
                style={{ color: '#0f172a', borderColor: '#d1d5db' }}
                onClick={() => setSelectedIds(new Set(pallets.map((p) => p.id)))}
              >
                Select all
              </button>
              <button
                className="btn btn-outline"
                style={{ color: '#0f172a', borderColor: '#d1d5db' }}
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleDownloadZip(selectedPallets)}
              disabled={isZipping || selectedIds.size === 0}
            >
              {isZipping
                ? `Zipping ${zipProgress ? `${zipProgress.done}/${zipProgress.total}` : ''}…`
                : `Download ZIP (${selectedIds.size} selected)`}
            </button>
          </div>
          {zipError && <p className="error-text">{zipError}</p>}

          <table>
            <thead>
              <tr>
                <th></th>
                <th>Pallet</th>
                <th>Seller</th>
                <th>Status</th>
                <th>Photos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pallets.map((pallet) => {
                const photoCount = pallet.labelPhotoUrls.length + pallet.damageEvidencePhotoUrls.length;
                return (
                  <tr key={pallet.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(pallet.id)}
                        onChange={() => toggle(pallet.id)}
                      />
                    </td>
                    <td>{pallet.palletIndex}</td>
                    <td>{pallet.sellerName}</td>
                    <td>{STATUS_LABELS[pallet.status]}</td>
                    <td>{photoCount}</td>
                    <td>
                      <button
                        className="btn-danger-text"
                        style={{ color: '#0f172a', textDecoration: 'underline' }}
                        onClick={() => handleDownloadZip([pallet])}
                        disabled={isZipping || photoCount === 0}
                      >
                        Download this one
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
