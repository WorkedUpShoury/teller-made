import React, { useEffect, useState } from 'react';
import '../styles/ResumePreview.css';

export default function ResumePreview({ pdfBlob, isOpen, onClose }) {
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    if (isOpen && pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

      // Cleanup function to revoke the object URL to avoid memory leaks
      return () => {
        URL.revokeObjectURL(url);
        setPdfUrl('');
      };
    }
  }, [isOpen, pdfBlob]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="rp-modal-overlay" onClick={onClose}>
      <div className="rp-modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="rp-modal-header">
          <h2>Resume Preview</h2>
          <button className="rp-close-button" onClick={onClose} aria-label="Close preview">
            &times;
          </button>
        </header>
        <div className="rp-pdf-container">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Resume Preview"
              width="100%"
              height="100%"
              frameBorder="0"
            />
          ) : (
            <div className="rp-loading">Loading preview...</div>
          )}
        </div>
      </div>
    </div>
  );
}