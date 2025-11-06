// CameraScanner.js - Camera-based Barcode Scanner Component
// Location: /frontend/src/components/CameraScanner.js

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';

function CameraScanner({ onScan, onClose }) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    startScanning();
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setError(null);
      const html5QrCode = new Html5Qrcode("camera-scanner");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5Qrcode.FORMATS.QR_CODE,
          Html5Qrcode.FORMATS.UPC_A,
          Html5Qrcode.FORMATS.UPC_E,
          Html5Qrcode.FORMATS.EAN_13,
          Html5Qrcode.FORMATS.EAN_8,
          Html5Qrcode.FORMATS.CODE_128,
          Html5Qrcode.FORMATS.CODE_39,
          Html5Qrcode.FORMATS.ITF
        ]
      };

      await html5QrCode.start(
        { facingMode: "environment" }, // Use back camera
        config,
        (decodedText) => {
          // Successfully scanned
          console.log('Scanned:', decodedText);
          onScan(decodedText);
          stopScanning();
        },
        (errorMessage) => {
          // Scanning errors (can be ignored - these happen constantly)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Failed to start camera:', err);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  const stopScanning = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
    setIsScanning(false);
  };

  const handleClose = async () => {
    await stopScanning();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
        zIndex: 10000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
          <Camera size={24} />
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Scan Barcode</h2>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera View */}
      <div style={{
        maxWidth: '500px',
        width: '100%',
        padding: '1rem'
      }}>
        <div id="camera-scanner" style={{
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '3px solid #10B981'
        }}></div>
      </div>

      {/* Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '2rem',
        left: '1rem',
        right: '1rem',
        textAlign: 'center',
        color: 'white'
      }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem', fontWeight: '600' }}>
          Point camera at barcode
        </p>
        <p style={{ margin: 0, opacity: 0.8 }}>
          Scanning will happen automatically
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#EF4444',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          maxWidth: '90%'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default CameraScanner;