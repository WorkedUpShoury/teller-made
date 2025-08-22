import React, { useState, useRef, useEffect } from 'react';

function ResumeUploadPage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDesc, setJobDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setResumeFile(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async () => {
    if (!resumeFile || !jobDesc) {
      alert('Please upload your resume and paste the job description.');
      return;
    }

    setLoading(true);

    // Use FormData to send the file and text to the backend
    const formData = new FormData();
    formData.append('resumeFile', resumeFile);
    formData.append('jobDesc', jobDesc);

    try {
      const response = await fetch('http://127.0.0.1:5001/api/optimize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Try to get error message from backend, or use default
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP error! Status: ${response.status}`);
      }

      // Handle the file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'optimized_resume.docx'); // Set the filename
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('✅ Your resume has been optimized! The download has started.');

    } catch (error) {
      console.error('Error optimizing resume:', error);
      alert(`❌ Optimization failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div className="row justify-content-center py-5">
        <div className="col-md-8 col-lg-6 text-center">
          {/* Header Section */}
          <h1 className="mb-4" style={{ color: '#2c3e50', fontWeight: '700' }}>
            <>
            Tailor Your Resume with{' '}
            <span style={{
              background: 'linear-gradient(#A326A9, #D9529A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              AI Precision
            </span>
          </>


          </h1>
          <p className="lead mb-5" style={{ color: '#7f8c8d' }}>
            Upload your resume, optimize keywords, and pass ATS filters to land your dream job.
          </p>

          {/* Upload Card */}
          <div className="card shadow-sm p-4 mb-5 bg-white rounded" style={{ border: 'none' }}>
            {/* Upload Button */}
            <div className="mb-4">
              <div 
                className="d-flex flex-column align-items-center justify-content-center p-5 border rounded"
                style={{ 
                  backgroundColor: '#f0f7fd', 
                  border: '2px dashed #db00b6 !important',
                  cursor: 'pointer'
                }}
                onClick={handleUploadClick}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx"
                  className="d-none"
                  onChange={handleFileChange}
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="#db00b6" viewBox="0 0 16 16">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                </svg>
                <h5 className="mt-3" style={{ color: '#db00b6' }}>
                  {resumeFile ? resumeFile.name : 'Upload Your Resume'}
                </h5>
                <p className="text-muted">PDF, DOC, DOCX (Max 5MB)</p>
              </div>
            </div>

            {/* Job Description Textarea */}
            <div className="mb-4">
              <label className="form-label fw-bold" style={{ color: '#db00b6' }}>Job Description</label>
              <textarea
                className="form-control"
                rows="8"
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="Paste the job description here..."
                style={{ borderColor: '#dfe6e9' }}
              />
            </div>

            {/* Analyze Button */}
            <button 
              className="btn btn-primary w-100 py-3 fw-bold" 
              onClick={handleSubmit}
              disabled={loading}
              style={{ 
                background: 'linear-gradient(45deg, #A326A9, #D9529A)', 
                border: 'none',
                fontSize: '1.1rem'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Optimizing...
                </>
              ) : (
                'Optimize My Resume'
              )}
            </button>
          </div>

          {/* Features Section */}
          <div className="row mt-5">
            <div className="col-md-4 mb-4">
              <div className="p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#db00b6" className="bi bi-magic" viewBox="0 0 16 16">
                  <path d="M9.5 2.672a.5.5 0 1 0 1 0V.843a.5.5 0 0 0-1 0v1.829zm4.5.035A.5.5 0 0 0 13.293 2L12 3.293a.5.5 0 1 0 .707.707L14 2.707zM7.293 4A.5.5 0 1 0 8 3.293L6.707 2A.5.5 0 0 0 6 2.707L7.293 4zm-.621 2.5a.5.5 0 1 0 0-1H4.843a.5.5 0 1 0 0 1h1.829zm8.485 0a.5.5 0 1 0 0-1h-1.829a.5.5 0 0 0 0 1h1.829zM13.293 10a.5.5 0 1 0 .707 0L14 8.707a.5.5 0 0 0-.707-.707L13.293 10zm-7.171 0a.5.5 0 1 0 .707 0L8 8.707a.5.5 0 0 0-.707-.707L6.293 10zM4.5 13.157a.5.5 0 1 0 1 0v-1.829a.5.5 0 1 0-1 0v1.829zm10.5-.035a.5.5 0 0 0 .707-.707L14 12.707a.5.5 0 0 0-.707.707l1.293 1.293zm-8.486 0a.5.5 0 0 0 .707-.707L6 12.707a.5.5 0 0 0-.707.707l1.293 1.293z"/>
                  <path d="M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
                </svg>
                <h5 className="mt-2" style={{ color: '#2c3e50' }}>AI Optimization</h5>
                <p className="text-muted">Smart keyword matching for ATS systems</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#db00b6" className="bi bi-chat-square-text" viewBox="0 0 16 16">
                  <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                  <path d="M3 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z"/>
                </svg>
                <h5 className="mt-2" style={{ color: '#2c3e50' }}>ATS Friendly</h5>
                <p className="text-muted">Format optimized for applicant tracking systems</p>
              </div>
            </div>
            <div className="col-md-4 mb-4">
              <div className="p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="#db00b6" className="bi bi-lightning-charge" viewBox="0 0 16 16">
                  <path d="M11.251.068a.5.5 0 0 1 .227.58L9.677 6.5H13a.5.5 0 0 1 .364.843l-8 8.5a.5.5 0 0 1-.842-.49L6.323 9.5H3a.5.5 0 0 1-.364-.843l8-8.5a.5.5 0 0 1 .615-.09zM4.157 8.5H7a.5.5 0 0 1 .478.647L6.11 13.59l5.732-6.09H9a.5.5 0 0 1-.478-.647L9.89 2.41 4.157 8.5z"/>
                </svg>
                <h5 className="mt-2" style={{ color: '#2c3e50' }}>Fast Results</h5>
                <p className="text-muted">Get an optimized resume in seconds</p>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div 
            className="mt-4 p-4 text-white rounded"
            style={{
              background: 'linear-gradient(45deg, #A326A9, #D9529A)'
            }}
          >
            <h4>Ready to transform your job search?</h4>
            <p>Free forever • No credit card required</p>
            <button 
              className="px-4 py-2 fw-bold"
              style={{
                background: 'white',
                color: '#A326A9',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Try it Now
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ResumeUploadPage;