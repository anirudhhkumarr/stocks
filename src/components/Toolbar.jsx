import React, { useRef } from 'react';
import { Upload, X } from 'lucide-react';

const Toolbar = ({ w2Income, setW2Income, files, onFileUpload, onFileRemove }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      onFileUpload(selectedFiles);
    }
  };

  return (
    <div className="actions-toolbar">
      <div className="actions-group">
        <div className="w2-input-wrapper">
          <label htmlFor="w2Income">W2 Income</label>
          <input
            type="number"
            id="w2Income"
            value={w2Income || ''}
            onChange={(e) => setW2Income(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 150000"
            min="0"
            className="toolbar-input"
          />
        </div>
        <div className="file-upload-wrapper">
          <input
            type="file"
            id="csvInput"
            multiple
            accept=".csv"
            className="file-input"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label
            htmlFor="csvInput"
            className="toolbar-btn"
          >
            <Upload size={18} className="icon" />
            <span className="text">Upload CSVs</span>
          </label>
        </div>
        <button
          className="toolbar-btn danger"
          onClick={() => {
            if (confirm('Clear all local data and reset defaults?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          style={{ marginLeft: 'auto' }}
        >
          Reset
        </button>
      </div>

      <div id="activeFiles" className="file-chips">
        {Object.keys(files).map((filename) => (
          <div key={filename} className="file-chip">
            <span className="name">{filename}</span>
            <button
              className="remove-btn"
              onClick={() => onFileRemove(filename)}
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Toolbar;
