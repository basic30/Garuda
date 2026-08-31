import React, { useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, FileImage, Loader2, Compass } from 'lucide-react';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [lat, setLat] = useState('1.2800');
  const [lon, setLon] = useState('103.8500');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [hasMetadata, setHasMetadata] = useState(false);
  const [isValidSar, setIsValidSar] = useState(true);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
      setHasMetadata(false);
      setIsValidSar(true);

      // Auto-extract metadata & validate SAR image characteristics
      setExtracting(true);
      const metaData = new FormData();
      metaData.append('file', file);

      try {
        const res = await fetch('http://127.0.0.1:8000/api/detection/extract-metadata', {
          method: 'POST',
          body: metaData
        });
        if (res.ok) {
          const data = await res.json();
          if (data.is_valid_sar === false) {
            setIsValidSar(false);
            setError(data.sar_reason || 'Selected file is not a valid SAR satellite radar image.');
          } else {
            setIsValidSar(true);
            if (data.has_metadata && data.latitude !== null && data.longitude !== null) {
              setLat(data.latitude.toString());
              setLon(data.longitude.toString());
              setHasMetadata(true);
            }
          }
        }
      } catch (err) {
        console.warn('Metadata extraction failed:', err);
      } finally {
        setExtracting(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a SAR image file.');
      return;
    }

    if (!isValidSar) {
      setError(error || 'Cannot process file: Uploaded image is not a valid SAR satellite radar scan.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('latitude', lat);
    formData.append('longitude', lon);

    try {
      const response = await fetch('http://sagar-netra-api.onrender.com/api/detection/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Image segmentation upload failed.');
      }

      setUploading(false);
      onUploadSuccess(data);
      onClose();
    } catch (err) {
      setUploading(false);
      setError(err.message || 'Error processing image.');
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            Upload Custom SAR Satellite Image
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Dropzone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/70 rounded-xl p-6 text-center transition-colors bg-slate-900/50 cursor-pointer">
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.tif,.tiff,.bmp"
              onChange={handleFileChange}
              className="hidden"
              id="sar-file-input"
            />
            <label htmlFor="sar-file-input" className="cursor-pointer block space-y-2">
              <FileImage className="w-10 h-10 text-cyan-400 mx-auto" />
              {selectedFile ? (
                <div className="max-w-full overflow-hidden px-2">
                  <div
                    className="text-sm font-semibold text-slate-200 truncate max-w-full"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5 font-medium">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-medium text-slate-200">Click to select or drag SAR image file</div>
                  <div className="text-xs text-slate-400 font-mono mt-1">Supports PNG, JPG, TIFF, BMP</div>
                </div>
              )}
            </label>
          </div>

          {/* Latitude / Longitude Coords */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-medium">Target Coordinates</span>
              {extracting && (
                <span className="text-cyan-400 text-[11px] animate-pulse flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Reading GPS Metadata...
                </span>
              )}
              {hasMetadata && !extracting && (
                <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Auto-detected from image metadata
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Latitude (°N)</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => {
                    setLat(e.target.value);
                    setHasMetadata(false);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Target Longitude (°E)</label>
                <input
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => {
                    setLon(e.target.value);
                    setHasMetadata(false);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || extracting || !isValidSar}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                !isValidSar
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg hover:from-cyan-500 hover:to-blue-500'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running U-Net Inference...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Segment & Detect Spill
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
