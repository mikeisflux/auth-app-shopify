// CsvUpload.js - Futuristic Styled Version
// Location: /frontend/src/components/CsvUpload.js

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, Filter, Database, Zap } from 'lucide-react';

function CsvUpload() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a valid CSV file');
    }
  }, []);

  const handleFileChange = useCallback((e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a valid CSV file');
      }
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setError(null);

    const formData = new FormData();
    formData.append('csv', file);

    try {
      setProgress(30);
      
      const response = await fetch(`/api/import/project/${projectId}/upload`, {
        method: 'POST',
        body: formData,
      });

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setProgress(100);

      console.log('Upload successful:', result);

      // Navigate to mapping page after brief delay
      setTimeout(() => {
        navigate(`/project/${projectId}/mapping`);
      }, 500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  }, [file, projectId, navigate]);

  return (
    <div className="csv-upload-container">
      <div className="csv-upload-max-width">
        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 className="dashboard-title">Upload Kickstarter CSV</h1>
            <p className="dashboard-subtitle">Upload your Kickstarter backer report to begin importing orders</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-white"
          >
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="alert-error" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', marginLeft: 'auto' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Drop Zone */}
        <div
          className={`csv-dropzone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="csv-dropzone-icon">
            <Upload size={40} />
          </div>

          {file ? (
            <div className="csv-file-preview">
              <FileText size={24} style={{ color: '#059669' }} />
              <span style={{ fontWeight: '600', color: '#1F2937' }}>{file.name}</span>
              <CheckCircle size={20} style={{ color: '#059669' }} />
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                Drop your CSV file here
              </h3>
              <p style={{ color: '#6B7280', marginBottom: '1rem' }}>or</p>
            </div>
          )}

          <label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button className="btn-gradient-primary" type="button" onClick={(e) => e.currentTarget.previousElementSibling.click()}>
              {file ? 'Choose Different File' : 'Browse Files'}
            </button>
          </label>

          <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginTop: '1rem' }}>
            Accepts CSV files from Kickstarter backer reports
          </p>
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="csv-progress-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>Uploading...</span>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>{progress}%</span>
            </div>
            <div className="csv-progress-bar">
              <div className="csv-progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <div style={{ textAlign: 'center', margin: '2rem 0' }}>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="csv-upload-button"
            style={{ opacity: !file || uploading ? 0.5 : 1 }}
          >
            {uploading ? (
              <>
                <div className="loading-spinner"></div>
                <span>Uploading...</span>
              </>
            ) : file ? (
              <>
                <Upload size={20} />
                <span>Upload & Continue</span>
              </>
            ) : (
              <span>Select a File to Upload</span>
            )}
          </button>
        </div>

        {/* Info Cards */}
        <div className="csv-info-grid">
          <div className="csv-info-card">
            <div className="csv-info-card-icon">
              <FileText size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Required Columns
            </h3>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              Customer Name, Email, Backer #, Reward, Pledge Amount, Notes
            </p>
          </div>

          <div className="csv-info-card">
            <div className="csv-info-card-icon">
              <Filter size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Validation
            </h3>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              We'll validate your data automatically
            </p>
          </div>

          <div className="csv-info-card">
            <div className="csv-info-card-icon">
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Quick Process
            </h3>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              Upload completes in seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CsvUpload;