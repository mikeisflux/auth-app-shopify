// PullList.js - Printable Pick List for Order Picking
// Location: /frontend/src/components/PullList.js

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, CheckCircle, ArrowLeft, Package } from 'lucide-react';

function PullList() {
  const navigate = useNavigate();
  const { userId, assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [order, setOrder] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [userId, assignmentId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employee/${userId}/assignments/${assignmentId}/details`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch order details');
      }
      
      const data = await response.json();
      setAssignment(data.assignment);
      setOrder(data.order);
      
      // Fetch employee info
      const empResponse = await fetch(`/api/employee/${userId}/assignments`);
      const empData = await empResponse.json();
      setEmployee(empData.employee);
      
      setError(null);
    } catch (err) {
      console.error('Error fetching order details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMoveToScanning = async () => {
    try {
      const response = await fetch(`/api/employee/${userId}/assignments/${assignmentId}/move-to-scanning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to move to scanning');
      
      // Navigate to scanning page
      navigate(`/employee/${userId}/scan/${assignmentId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="fulfillment-container">
        <div className="dashboard-max-width">
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading pull list...</p>
          </div>
        </div>
      </div>
    );
  }

  const totalItems = order?.line_items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className="fulfillment-container">
      <div className="dashboard-max-width">
        {/* Screen Header (hidden when printing) */}
        <div className="no-print" style={{ marginBottom: '2rem' }}>
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title" style={{ 
                background: 'linear-gradient(to right, #3B82F6, #6366F1)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent' 
              }}>
                📋 Pull List - Station {employee?.stationNumber}
              </h1>
              <p className="dashboard-subtitle">Order {assignment?.orderName}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handlePrint} className="btn-white">
                <Printer size={18} />
                <span>Print List</span>
              </button>
              <button onClick={() => navigate(`/employee/${userId}`)} className="btn-white">
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="alert-error" style={{ marginBottom: '2rem' }}>
              <span>{error}</span>
            </div>
          )}

          {/* Action Button */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <button
              onClick={handleMoveToScanning}
              style={{
                padding: '1rem 2rem',
                background: 'linear-gradient(to right, #10B981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '1.125rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
            >
              <CheckCircle size={20} />
              Items Picked - Start Scanning
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="print-content" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '1rem',
          border: '2px solid #E5E7EB'
        }}>
          {/* Print Header */}
          <div style={{ 
            borderBottom: '3px solid #1F2937', 
            paddingBottom: '1.5rem', 
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start'
          }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '0.5rem' }}>
                PICK LIST
              </h1>
              <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>
                Station {employee?.stationNumber} - {employee?.displayName}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3B82F6' }}>
                {assignment?.orderName}
              </div>
              <div style={{ fontSize: '1rem', color: '#6B7280', marginTop: '0.25rem' }}>
                {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Order Info */}
          <div style={{ 
            background: '#F3F4F6', 
            padding: '1.5rem', 
            borderRadius: '0.75rem',
            marginBottom: '2rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem'
          }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Customer Email</p>
              <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937' }}>
                {order?.customer?.email || 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Total Items</p>
              <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937' }}>
                {totalItems} items
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Order Total</p>
              <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#10B981' }}>
                ${parseFloat(order?.total_price || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.25rem' }}>Priority</p>
              <p style={{ fontSize: '1.125rem', fontWeight: '600', color: assignment?.priority > 0 ? '#EF4444' : '#6B7280' }}>
                {assignment?.priority > 0 ? '⚠️ HIGH' : 'Normal'}
              </p>
            </div>
          </div>

          {/* Special Notes */}
          {assignment?.notes && (
            <div style={{ 
              background: '#FEF3C7', 
              border: '2px solid #FDE047',
              padding: '1rem', 
              borderRadius: '0.75rem',
              marginBottom: '2rem'
            }}>
              <p style={{ fontWeight: 'bold', color: '#92400E', marginBottom: '0.5rem', fontSize: '1rem' }}>
                ⚠️ SPECIAL INSTRUCTIONS:
              </p>
              <p style={{ color: '#78350F', fontSize: '1rem' }}>{assignment.notes}</p>
            </div>
          )}

          {/* Items to Pick */}
          <div>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#1F2937', 
              marginBottom: '1rem',
              borderBottom: '2px solid #E5E7EB',
              paddingBottom: '0.5rem'
            }}>
              ITEMS TO PICK ({order?.line_items.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {order?.line_items.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 150px 100px 100px',
                    gap: '1rem',
                    padding: '1.5rem',
                    background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    border: '2px solid #E5E7EB',
                    borderRadius: '0.75rem',
                    alignItems: 'center',
                    pageBreakInside: 'avoid'
                  }}
                >
                  {/* Checkbox */}
                  <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    border: '3px solid #1F2937',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#6B7280' }}>
                      {index + 1}
                    </span>
                  </div>

                  {/* Product Info */}
                  <div>
                    <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.25rem' }}>
                      {item.title}
                    </p>
                    {item.variant_title && item.variant_title !== 'Default Title' && (
                      <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                        Variant: {item.variant_title}
                      </p>
                    )}
                  </div>

                  {/* SKU */}
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>SKU</p>
                    <p style={{ 
                      fontSize: '1rem', 
                      fontWeight: '600', 
                      color: '#1F2937',
                      fontFamily: 'monospace',
                      background: '#F3F4F6',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem'
                    }}>
                      {item.sku || 'N/A'}
                    </p>
                  </div>

                  {/* Quantity */}
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: '0.25rem' }}>QTY</p>
                    <p style={{ 
                      fontSize: '2rem', 
                      fontWeight: 'bold', 
                      color: '#3B82F6',
                      lineHeight: '1'
                    }}>
                      {item.quantity}
                    </p>
                  </div>

                  {/* Manual Checkbox */}
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    border: '4px solid #1F2937',
                    borderRadius: '0.5rem'
                  }} />
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ 
            marginTop: '3rem', 
            paddingTop: '1.5rem', 
            borderTop: '2px solid #E5E7EB',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem'
          }}>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.5rem' }}>Picked By:</p>
              <div style={{ 
                borderBottom: '2px solid #1F2937', 
                height: '40px',
                marginBottom: '1rem'
              }} />
              <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>Signature</p>
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginBottom: '0.5rem' }}>Date/Time Completed:</p>
              <div style={{ 
                borderBottom: '2px solid #1F2937', 
                height: '40px',
                marginBottom: '1rem'
              }} />
              <p style={{ fontSize: '0.75rem', color: '#6B7280' }}>Time</p>
            </div>
          </div>

          {/* Barcode Section */}
          <div style={{ 
            marginTop: '2rem',
            padding: '1rem',
            background: '#EEF2FF',
            border: '2px dashed #6366F1',
            borderRadius: '0.75rem',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '1rem', fontWeight: '600', color: '#4F46E5' }}>
              ✓ After picking, proceed to scanning station to verify each item
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .fulfillment-container {
            padding: 0 !important;
          }
          .dashboard-max-width {
            max-width: 100% !important;
            padding: 0 !important;
          }
          .print-content {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}

export default PullList;