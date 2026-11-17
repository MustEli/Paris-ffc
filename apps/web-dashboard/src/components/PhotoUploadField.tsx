import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../core/api/client';
import { resolvePhotoUrl, uploadPhoto } from '../core/api/upload';
import { useAuth } from '../core/auth/AuthContext';

interface PhotoUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}

/** A single-photo upload field — picks a file, uploads it immediately via POST /uploads, and stores the returned URL. */
export function PhotoUploadField({ label, value, onChange }: PhotoUploadFieldProps) {
  const { t } = useTranslation('taskBoard');
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const url = await uploadPhoto(token!, file);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('photoUpload.failedToUpload'));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="form-row">
      <label className="form-label">{label}</label>
      {value ? (
        <div className="flex-row" style={{ alignItems: 'center' }}>
          <img src={resolvePhotoUrl(value)} alt={label} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
          <button className="btn btn-outline" onClick={() => onChange(null)}>
            <X size={14} />
            {t('photoUpload.remove')}
          </button>
        </div>
      ) : (
        <button
          className="btn btn-outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload size={14} />
          {isUploading ? t('photoUpload.uploading') : t('photoUpload.upload')}
        </button>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelected} />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
