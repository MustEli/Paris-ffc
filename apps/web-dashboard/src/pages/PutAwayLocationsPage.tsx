import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import { ApiError } from '../core/api/client';
import {
  bulkUpsertWarehouseLocations,
  createWarehouseLocation,
  fetchWarehouseLocations,
  removeWarehouseLocation,
  updateWarehouseLocation,
  type BulkWarehouseLocationResult,
  type WarehouseLocation,
} from '../core/api/warehouseLocations';
import { useAuth } from '../core/auth/AuthContext';

interface TemplateRow {
  Location: string;
  Description: string;
}

function downloadTemplate() {
  const rows: TemplateRow[] = [
    { Location: 'Zone A - Rack 04', Description: 'Near the loading dock' },
    { Location: 'Zone B - Rack 12', Description: '' },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 40 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Locations');
  XLSX.writeFile(book, `elno-locations-template-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

async function parseUploadedFile(file: File): Promise<{ location: string; description?: string }[]> {
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: 'array' });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Partial<TemplateRow>>(sheet);

  return rows
    .filter((row) => row.Location && row.Location.trim())
    .map((row) => ({
      location: String(row.Location).trim(),
      description: row.Description ? String(row.Description).trim() : undefined,
    }));
}

/**
 * Admin-managed table of put-away target locations (Location +
 * Description for now — more columns can be added to the table/form
 * later without changing this page's shape). Feeds every "Put-away
 * location" dropdown on mobile (Seller Stock's self put-away, and every
 * instant put-away form) — plain react-query with no custom staleTime,
 * so a location added here shows up there the next time staff open that
 * screen, no extra sync step needed.
 */
export function PutAwayLocationsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey: ['warehouse-locations'],
    queryFn: () => fetchWarehouseLocations(token!),
    enabled: !!token,
  });

  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ location: '', description: '' });
  const [editError, setEditError] = useState<string | null>(null);

  const [preview, setPreview] = useState<{ location: string; description?: string }[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkWarehouseLocationResult[] | null>(null);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['warehouse-locations'] });
  }

  async function handleAdd() {
    if (!newLocation.trim()) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await createWarehouseLocation(token!, newLocation.trim(), newDescription.trim());
      setNewLocation('');
      setNewDescription('');
      refresh();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to add location');
    } finally {
      setIsAdding(false);
    }
  }

  function startEdit(location: WarehouseLocation) {
    setEditingId(location.id);
    setEditDraft({ location: location.location, description: location.description ?? '' });
    setEditError(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft.location.trim()) return;
    setEditError(null);
    try {
      await updateWarehouseLocation(token!, id, {
        location: editDraft.location.trim(),
        description: editDraft.description.trim(),
      });
      setEditingId(null);
      refresh();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Failed to save changes');
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeWarehouseLocation(token!, id);
      refresh();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to remove location');
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setParseError(null);
    setBulkResults(null);
    try {
      const rows = await parseUploadedFile(file);
      if (rows.length === 0) {
        setParseError('No rows with a Location value were found in that file.');
        setPreview(null);
        return;
      }
      setPreview(rows);
    } catch {
      setParseError('Could not read that file — make sure it is the .xlsx template, unedited in structure.');
      setPreview(null);
    }
  }

  async function handleConfirmBulk() {
    if (!preview) return;
    setIsSubmittingBulk(true);
    try {
      const outcome = await bulkUpsertWarehouseLocations(token!, preview);
      setBulkResults(outcome);
      setPreview(null);
      refresh();
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : 'Bulk upload failed');
    } finally {
      setIsSubmittingBulk(false);
    }
  }

  const locations = data ?? [];

  return (
    <div>
      <h1>Put-Away & Location Assignment</h1>
      <p className="page-subtitle">
        These locations feed the "Put-away location" dropdown staff use on the mobile app — anything added, edited,
        or removed here shows up there the next time they open that screen.
      </p>

      {isPending && <p>Loading…</p>}
      {error && <p className="error-text">{error.message}</p>}

      <div className="card">
        <div className="section-toolbar">
          <h2 style={{ margin: 0 }}>Bulk upload via Excel</h2>
        </div>
        <div className="flex-row" style={{ marginBottom: 12 }}>
          <button className="btn btn-accent" onClick={downloadTemplate}>
            Download Template
          </button>
          <button
            className="btn btn-outline"
            style={{ color: '#0f172a', borderColor: '#d1d5db' }}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Filled Template
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleFileSelected} />
        </div>
        <p className="hint-text" style={{ marginTop: 0 }}>
          A row whose Location already exists updates its Description instead of creating a duplicate.
        </p>
        {parseError && <p className="error-text">{parseError}</p>}

        {preview && (
          <div style={{ marginTop: 16 }}>
            <h2>Preview — {preview.length} row(s) will be added or updated</h2>
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.location}>
                    <td>{row.location}</td>
                    <td>{row.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex-row" style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleConfirmBulk} disabled={isSubmittingBulk}>
                {isSubmittingBulk ? 'Submitting…' : `Confirm and apply ${preview.length} location(s)`}
              </button>
              <button
                className="btn btn-outline"
                style={{ color: '#0f172a', borderColor: '#d1d5db' }}
                onClick={() => setPreview(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {bulkResults && (
          <div style={{ marginTop: 16 }}>
            <h2>Result</h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {bulkResults.map((r) => (
                <li key={r.location} style={{ color: r.success ? '#15803d' : '#dc2626' }}>
                  {r.success ? 'Applied' : `Failed: ${r.error}`} — {r.location}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <h2>Locations ({locations.length})</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Description</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) =>
              editingId === location.id ? (
                <tr key={location.id}>
                  <td>
                    <input
                      type="text"
                      value={editDraft.location}
                      onChange={(e) => setEditDraft((d) => ({ ...d, location: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={editDraft.description}
                      onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  </td>
                  <td>
                    <div className="flex-row">
                      <button className="btn btn-primary" onClick={() => saveEdit(location.id)}>
                        Save
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{ color: '#0f172a', borderColor: '#d1d5db' }}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={location.id}>
                  <td>{location.location}</td>
                  <td>{location.description || '—'}</td>
                  <td>
                    <div className="flex-row">
                      <button className="btn btn-outline" style={{ color: '#0f172a', borderColor: '#d1d5db' }} onClick={() => startEdit(location)}>
                        Edit
                      </button>
                      <button className="btn-danger-text" onClick={() => handleRemove(location.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {locations.length === 0 && !isPending && <p className="hint-text">No locations yet — add one below.</p>}
        {editError && <p className="error-text">{editError}</p>}

        <div className="flex-row" style={{ marginTop: 16 }}>
          <input
            type="text"
            placeholder="Location (e.g. Zone A - Rack 04)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            disabled={isAdding}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            disabled={isAdding}
          />
          <button className="btn btn-primary" onClick={handleAdd} disabled={isAdding || !newLocation.trim()}>
            Add
          </button>
        </div>
        {addError && <p className="error-text">{addError}</p>}
      </div>
    </div>
  );
}
