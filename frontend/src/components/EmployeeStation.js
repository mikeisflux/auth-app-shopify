// EmployeeStation.js - Employee Station Interface
// Location: /frontend/src/components/EmployeeStation.js

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, CheckCircle, Clock, FileText, Scan, ArrowLeft, RefreshCw } from 'lucide-react';

function EmployeeStation() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [employee, setEmployee] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userId) {
      fetchAssignments();
      // Refresh every 30 seconds
      const interval = setInterval(fetchAssignments, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employee/${userId}/assignments`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }
      
      const data = await response.json();
      setEmployee(data.employee);
      setAssignments(data.assignments || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrder = async (assignmentId) => {
    try {
      const response = await fetch(`/api/employee/${userId}/assignments/${assignmentId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to start order');
      
      // Navigate to pull list
      navigate(`/employee/${userId}/pull-list/${assignmentId}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleContinueOrder = (assignmentId, status) => {
    if (status === 'picking') {
      navigate(`/employee/${userId}/pull-list/${assignmentId}`);
    } else if (status === 'scanning' || status === 'packing') {
      navigate(`/employee/${userId}/scan/${assignmentId}`);
    }
  };

  const getTotalItems = (assignment) => {
    return assignment.totalItems || 0;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return '#F59E0B';
      case 'picking': return '#3B82F6';
      case 'scanning': return '#8B5CF6';
      case 'packing': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'assigned': return <Clock size={20} />;
      case 'picking': return <FileText size={20} />;
      case 'scanning': return <Scan size={20} />;
      case 'packing': return <Package size={20} />;
      default: return <Package size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="fulfillment-container">
        <div className="dashboard-max-width">
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading your assignments...</p>
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
              background: 'linear-gradient(to right, #3B82F6, #6366F1)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              🎯 Station {employee?.stationNumber} - {employee?.displayName}
            </h1>
            <p className="dashboard-subtitle">Your assigned orders</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={fetchAssignments} className="btn-white">
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <button onClick={() => navigate('/fulfillment')} className="btn-white">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="alert-error" style={{ marginBottom: '2rem' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Stats */}
        <div className="csv-info-grid" style={{ marginBottom: '2rem' }}>
          <div className="csv-info-card">
            <div className="csv-info-card-icon">
              <Package size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Total Assigned
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3B82F6' }}>
              {assignments.length}
            </p>
          </div>

          <div className="csv-info-card">
            <div className="csv-info-card-icon">
              <Clock size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              In Progress
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#F59E0B' }}>
              {assignments.filter(a => ['picking', 'scanning', 'packing'].includes(a.status)).length}
            </p>
          </div>

          <div className="csv-info-card">
            <div className="csv-info-card-icon">
              <CheckCircle size={24} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              Not Started
            </h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6B7280' }}>
              {assignments.filter(a => a.status === 'assigned').length}
            </p>
          </div>
        </div>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h2 className="empty-state-title">No Assignments Yet</h2>
            <p className="empty-state-text">You don't have any orders assigned. Check back soon!</p>
          </div>
        ) : (
          <div className="project-grid">
            {assignments.map(assignment => {
              const totalItems = getTotalItems(assignment);
              const statusColor = getStatusColor(assignment.status);
              const StatusIcon = getStatusIcon(assignment.status);
              
              return (
                <div key={assignment.id} className="project-card">
                  {/* Order Header */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 className="project-name">Order {assignment.orderName}</h3>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.25rem 0.75rem',
                        background: `${statusColor}20`,
                        color: statusColor,
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        textTransform: 'capitalize'
                      }}>
                        {StatusIcon}
                        {assignment.status}
                      </div>
                    </div>
                    <p className="project-date">{assignment.customerEmail}</p>
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
                          ${parseFloat(assignment.orderTotal || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: '#6B7280' }}>Assigned</p>
                        <p style={{ fontWeight: '600', color: '#1F2937' }}>
                          {new Date(assignment.assignedAt).toLocaleString()}
                        </p>
                      </div>
                      {assignment.priority > 0 && (
                        <div>
                          <p style={{ color: '#6B7280' }}>Priority</p>
                          <p style={{ fontWeight: '600', color: '#EF4444' }}>⚠️ High</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {assignment.notes && (
                    <div style={{ 
                      padding: '0.75rem', 
                      background: '#FEF3C7', 
                      border: '1px solid #FDE047',
                      borderRadius: '0.5rem', 
                      marginBottom: '1rem',
                      fontSize: '0.875rem'
                    }}>
                      <p style={{ fontWeight: '600', color: '#92400E', marginBottom: '0.25rem' }}>📝 Notes:</p>
                      <p style={{ color: '#78350F' }}>{assignment.notes}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="project-actions">
                    {assignment.status === 'assigned' ? (
                      <button
                        onClick={() => handleStartOrder(assignment.id)}
                        className="project-btn-primary"
                      >
                        <FileText size={18} />
                        <span>Start Picking</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleContinueOrder(assignment.id, assignment.status)}
                        className="project-btn-primary"
                      >
                        <Scan size={18} />
                        <span>Continue</span>
                      </button>
                    )}
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

export default EmployeeStation;