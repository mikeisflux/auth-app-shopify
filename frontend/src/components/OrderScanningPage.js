// OrderScanStation.js - Barcode Scanning Interface with Camera Support
// Location: /frontend/src/components/OrderScanStation.js

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Package, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowLeft,
  Camera,
  Printer,
  RotateCcw
} from 'lucide-react';
import CameraScanner from './CameraScanner';

function OrderScanStation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const barcodeInputRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [verifiedItems, setVerifiedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  useEffect(() => {
    // Auto-focus input field when component loads or after scan
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scanResult]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fulfillment/orders/${orderId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      
      const data = await response.json();
      setOrder(data.order);
      setVerifiedItems(data.verifiedItems || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      handleScan(barcodeInput.trim());
    }
  };

  const handleCameraScan = (barcode) => {
    setShowCamera(false);
    handleScan(barcode);
  };

  const handleScan = async (barcode) => {
    if (!barcode) return;

    setScanning(true);
    setScanResult(null);

    try {
      const response = await fetch('/api/fulfillment/verify-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          scannedBarcode: barcode
        })
      });

      const data = await response.json();

      if (data.success) {
        // Success - play success sound and show feedback
        setScanResult({
          type: 'success',
          message: data.message,
          lineItem: data.lineItem
        });

        // Add to verified items
        setVerifiedItems([...verifiedItems, {
          lineItemId: data.lineItem.id,
          sku: data.lineItem.sku,
          scannedAt: new Date()
        }]);

        // Auto-clear after 2 seconds
        setTimeout(() => {
          setScanResult(null);
          setBarcodeInput('');
        }, 2000);

      } else {
        // Failed - show error
        setScanResult({
          type: 'error',
          message: data.message
        });

        // Auto-clear after 3 seconds
        setTimeout(() => {
          setScanResult(null);
          setBarcodeInput('');
        }, 3000);
      }

    } catch (err) {
      console.error('Scan error:', err);
      setScanResult({
        type: 'error',
        message: 'Failed to verify barcode'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleClearVerifications = async () => {
    if (!window.confirm('Clear all scanned items? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/fulfillment/orders/${orderId}/clear-verifications`, {
        method: 'POST'
      });

      if (response.ok) {
        setVerifiedItems([]);
        setScanResult({
          type: 'success',
          message: 'All verifications cleared'
        });
        setTimeout(() => setScanResult(null), 2000);
      }
    } catch (err) {
      console.error('Failed to clear verifications:', err);
    }
  };

  const handleMarkReadyForLabel = async () => {
    try {
      const response = await fetch(`/api/fulfillment/orders/${orderId}/ready-for-label`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        alert('Order ready for label printing!');
        navigate('/fulfillment');
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to mark ready:', err);
      alert('Failed to mark order as ready');
    }
  };

  const getTotalItems = () => {
    if (!order) return 0;
    return order.line_items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getProgress = () => {
    const total = getTotalItems();
    if (total === 0) return 0;
    return Math.round((verifiedItems.length / total) * 100);
  };

  const isItemVerified = (lineItemId) => {
    return verifiedItems.some(v => v.lineItemId === lineItemId.toString());
  };

  if (loading) {
    return (
      <div className="fulfillment-container">
        <div className="dashboard-max-width">
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <p>Loading order...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fulfillment-container">
        <div className="dashboard-max-width">
          <div className="alert-error">
            <AlertCircle size={20} />
            <span>{error || 'Order not found'}</span>
          </div>
          <button onClick={() => navigate('/fulfillment')} className="btn-white">
            <ArrowLeft size={18} />
            <span>Back to Orders</span>
          </button>
        </div>
      </div>
    );
  }

  const progress = getProgress();
  const totalItems = getTotalItems();
  const allItemsVerified = verifiedItems.length >= totalItems;

  return (
    <div className="fulfillment-container">
      <div className="dashboard-max-width">
        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 className="dashboard-title">Order {order.name}</h1>
            <p className="dashboard-subtitle">{order.customer?.email || 'No email'}</p>
          </div>
          <button onClick={() => navigate('/fulfillment')} className="btn-white">
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: '600', color: '#1F2937' }}>
              Scanning Progress
            </span>
            <span style={{ fontWeight: '600', color: progress === 100 ? '#10B981' : '#6366F1' }}>
              {verifiedItems.length} / {totalItems} items
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '12px',
            background: '#E5E7EB',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: progress === 100 
                ? 'linear-gradient(to right, #10B981, #059669)'
                : 'linear-gradient(to right, #6366F1, #8B5CF6)',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
        </div>

        {/* Barcode Input with Camera Button */}
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Scan Items
          </h3>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scan barcode or type SKU..."
              autoFocus
              disabled={scanning}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1.125rem',
                border: '2px solid #E5E7EB',
                borderRadius: '0.75rem',
                outline: 'none'
              }}
            />
            <button
              onClick={() => setShowCamera(true)}
              style={{
                padding: '1rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '0.75rem',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '60px'
              }}
              title="Use Camera Scanner"
            >
              <Camera size={24} />
            </button>
          </div>

          {/* Scan Result Feedback */}
          {scanResult && (
            <div style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              background: scanResult.type === 'success' ? '#D1FAE5' : '#FEE2E2',
              border: `2px solid ${scanResult.type === 'success' ? '#10B981' : '#EF4444'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              {scanResult.type === 'success' ? (
                <CheckCircle size={24} style={{ color: '#059669', flexShrink: 0 }} />
              ) : (
                <XCircle size={24} style={{ color: '#DC2626', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{
                  margin: 0,
                  fontWeight: '600',
                  color: scanResult.type === 'success' ? '#065F46' : '#991B1B'
                }}>
                  {scanResult.message}
                </p>
                {scanResult.lineItem && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#047857' }}>
                    {scanResult.lineItem.title}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleClearVerifications}
              disabled={verifiedItems.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'white',
                border: '2px solid #E5E7EB',
                borderRadius: '0.75rem',
                color: '#6B7280',
                cursor: verifiedItems.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: verifiedItems.length === 0 ? 0.5 : 1
              }}
            >
              <RotateCcw size={18} />
              <span>Clear All</span>
            </button>

            {allItemsVerified && (
              <button
                onClick={handleMarkReadyForLabel}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(to right, #10B981, #059669)',
                  border: 'none',
                  borderRadius: '0.75rem',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600'
                }}
              >
                <Printer size={18} />
                <span>Print Label</span>
              </button>
            )}
          </div>
        </div>

        {/* Line Items List */}
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Order Items
          </h3>

          {order.line_items.map((item, idx) => {
            const verified = isItemVerified(item.id);
            
            return (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  background: verified ? '#D1FAE5' : '#F9FAFB',
                  border: `2px solid ${verified ? '#10B981' : '#E5E7EB'}`,
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                {verified ? (
                  <CheckCircle size={24} style={{ color: '#059669', flexShrink: 0 }} />
                ) : (
                  <Package size={24} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                )}
                
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '600', color: '#1F2937' }}>
                    {item.title}
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6B7280' }}>
                    SKU: {item.sku || 'N/A'} • Qty: {item.quantity}
                  </p>
                </div>

                {verified && (
                  <div style={{
                    background: '#10B981',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    ✓ Verified
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Camera Scanner Modal */}
      {showCamera && (
        <CameraScanner
          onScan={handleCameraScan}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

export default OrderScanStation;