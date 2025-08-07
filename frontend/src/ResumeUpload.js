import React, { useState, useRef, useEffect } from 'react';

function ResumeUploadPage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [jobDesc, setJobDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [chat, setChat] = useState([]);
  const chatEndRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setResumeFile(file);
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
    }
  };

  const handleSubmit = async () => {
    if (!resumeFile || !jobDesc) {
      alert('Please upload resume and enter job description.');
      return;
    }

    // Simulated AI response (Replace with actual API later)
    const userMessage = `Please optimize my resume based on this job description:\n${jobDesc}`;
    const aiResponse = `✅ Your resume has been optimized based on the job description! Click below to download.`;

    setLoading(true);
    setChat((prev) => [...prev, { sender: 'user', text: userMessage }]);

    setTimeout(() => {
      setChat((prev) => [...prev, { sender: 'ai', text: aiResponse }]);
      setLoading(false);
    }, 2000); // Simulated 2 sec delay
  };

  const handleDownload = () => {
    // Simulated download logic
    alert('🔽 Resume download started!');
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat]);

  return (
    <div className="container py-5">
      <h2 className="mb-4">Resume and Job Description Upload</h2>

      {/* Upload Section */}
      <div className="mb-3">
        <label className="form-label fw-bold">Upload Resume (PDF)</label>
        <input
          type="file"
          accept=".pdf"
          className="form-control"
          onChange={handleFileChange}
        />
      </div>

      {/* Preview Button */}
      {previewUrl && (
        <div className="mb-4">
          <button
            className="btn btn-outline-secondary btn-sm mb-2"
            onClick={() => window.open(previewUrl, '_blank')}
          >
            Preview Resume
          </button>
        </div>
      )}

      {/* JD Entry */}
      <div className="mb-3">
        <label className="form-label fw-bold">Job Description</label>
        <textarea
          className="form-control"
          rows="6"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
          placeholder="Paste the job description here..."
        />
      </div>

      {/* Analyze Button */}
      <button className="btn btn-primary" onClick={handleSubmit}>
        Analyze
      </button>

      {/* Loading Spinner */}
      {loading && (
        <div className="mt-4 text-center">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">Analyzing with AI...</p>
        </div>
      )}

      {/* AI Chat Section */}
      {chat.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-3">💬 AI Assistant</h4>

          <div
            className="chat-box p-3 mb-3 bg-light rounded shadow-sm"
            style={{ maxHeight: '300px', overflowY: 'auto' }}
          >
            {chat.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-3 p-2 rounded ${msg.sender === 'ai' ? 'bg-primary text-white' : 'bg-white border'}`}
              >
                <strong>{msg.sender === 'ai' ? 'AI Assistant' : 'You'}:</strong>
                <div className="mt-1">{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input (disabled for now) */}
          <textarea
            className="form-control"
            placeholder="AI Assistant will respond here after analysis..."
            rows="2"
            disabled
          />

          {/* Download Button (after AI reply) */}
          {chat.some((msg) => msg.sender === 'ai') && (
            <div className="mt-3 text-end">
              <button className="btn btn-success" onClick={handleDownload}>
                Download Optimized Resume
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ResumeUploadPage;
