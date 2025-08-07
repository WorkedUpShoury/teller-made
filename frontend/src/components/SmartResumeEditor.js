// src/components/SmartResumeEditor.js
import React, { useState } from 'react';

function SmartResumeEditor() {
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    if (file.type === 'text/plain') {
      const text = await file.text();
      setResumeText(text);
    } else {
      alert('Only .txt files are supported right now.');
    }
  };

  const handleSave = () => {
    alert('Resume Saved! (You can connect backend here)');
  };

  return (
    <div className="container py-5">
      <h2 className="mb-4">📝 Smart Resume Editor</h2>

      <div className="mb-3">
        <label className="form-label">Upload Resume (.txt only)</label>
        <input
          type="file"
          className="form-control"
          accept=".txt"
          onChange={handleFileChange}
        />
        {fileName && <p className="mt-2 text-muted">Editing: {fileName}</p>}
      </div>

      <textarea
        className="form-control mb-3"
        rows="15"
        value={resumeText}
        onChange={(e) => setResumeText(e.target.value)}
        placeholder="Resume content will appear here..."
      />

      <button className="btn btn-success" onClick={handleSave}>
        Save Changes
      </button>
    </div>
  );
}

export default SmartResumeEditor;
