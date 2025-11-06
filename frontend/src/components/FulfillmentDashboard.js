// FulfillmentDashboard.js - Barcode Scanning & Fulfillment
// Location: /frontend/src/components/FulfillmentDashboard.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, CheckCircle, XCircle, Scan, Printer, ArrowLeft, RefreshCw } from 'lucide-react';

function FulfillmentDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fulfillment/orders/ready-to-ship');
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }
      
      const data = await response.json();
      setOrders(data.orders || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/fulfillment/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const getTotalItems = (order) => {
    return order.line_items.reduce((sum, item) => sum + item.quantity, 0);
  };

  if (loading) {
    return (
      <div className="fulfillment-container">
        <div className="dashboard-max-width">
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fulfillment-container">
      <div className="dashboard-max-width">
        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 className="dashboard-title" style={{ 
              background: 'linear-gradient(to right, #10B981, #059669)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              📦 Fulfillment Center
            </h1>
            <p className="dashboard-subtitle">Scan barcodes to verify products before shipping</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={fetchOrders}
              className="btn-white"
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="btn-white"
            >
              <ArrowLeft size={18} />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="alert-error" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={20} />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="csv-info-grid" style={{ marginBottom: '2rem' }}>
            <div className="csv-info-card">
              <div className="csv-info-card-icon">
                <Package size={24} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                Ready to Ship
              </h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10B981' }}>
                {stats.readyToShip}
              </p>
            </div>

            <div className="csv-info-card">
              <div className="csv-info-card-icon">
                <Scan size={24} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                In Progress
              </h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#F59E0B' }}>
                {stats.inProgress}
              </p>
            </div>

            <div className="csv-info-card">
              <div className="csv-info-card-icon">
                <CheckCircle size={24} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
                Total Items
              </h3>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6366F1' }}>
                {stats.totalItems}
              </p>
            </div>
          </div>
        )}

        {/* Orders Grid */}
        {orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h2 className="empty-state-title">No Orders Ready to Ship</h2>
            <p className="empty-state-text">All paid orders have been fulfilled or there are no orders at this time.</p>
          </div>
        ) : (
          <div className="project-grid">
            {orders.map(order => {
              const totalItems = getTotalItems(order);
              
              return (
                <div key={order.id} className="project-card">
                  {/* Order Header */}
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 className="project-name">Order {order.name}</h3>
                    <p className="project-date">{order.customer?.email || 'No email'}</p>
                  </div>

                  {/* Order Details */}
                  <div style={{ 
                    padding: '1rem', 
                    background: '#F9FAFB', 
                    borderRadius: '0.75rem', 
                    marginBottom: '1rem' 
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
                      <div>
                        <p style={{ color: '#6B7280' }}>Items</p>
                        <p style={{ fontWeight: '600', color: '#1F2937' }}>{totalItems}</p>
                      </div>
                      <div>
                        <p style={{ color: '#6B7280' }}>Total</p>
                        <p style={{ fontWeight: '600', color: '#10B981' }}>
                          {order.currency} ${parseFloat(order.total_price || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: '#6B7280' }}>Created</p>
                        <p style={{ fontWeight: '600', color: '#1F2937' }}>
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: '#6B7280' }}>Status</p>
                        <p style={{ fontWeight: '600', color: '#10B981' }}>Paid</p>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Preview */}
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6B7280', marginBottom: '0.5rem' }}>
                      Products:
                    </p>
                    <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                      {order.line_items.slice(0, 3).map((item, idx) => (
                        <div key={idx} style={{ padding: '0.25rem 0' }}>
                          • {item.title} (x{item.quantity})
                        </div>
                      ))}
                      {order.line_items.length > 3 && (
                        <div style={{ color: '#6B7280', fontStyle: 'italic' }}>
                          + {order.line_items.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="project-actions">
                    <button
                      onClick={() => navigate(`/fulfillment/${order.id}`)}
                      className="project-btn-primary"
                    >
                      <Scan size={18} />
                      <span>Start Scanning</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default FulfillmentDashboard;