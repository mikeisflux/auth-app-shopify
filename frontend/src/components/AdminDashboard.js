// AdminDashboard.js - Admin Interface for Assigning Orders to Employees
// Location: /frontend/src/components/AdminDashboard.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, CheckCircle, Clock, ArrowLeft, RefreshCw, UserPlus } from 'lucide-react';

function AdminDashboard() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchEmployees(),
        fetchAvailableOrders(),
        fetchAssignments()
      ]);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    const response = await fetch('/api/admin/employees');
    if (!response.ok) throw new Error('Failed to fetch employees');
    const data = await response.json();
    setEmployees(data.employees || []);
  };

  const fetchAvailableOrders = async () => {
    const response = await fetch('/api/fulfillment/orders/ready-to-ship');
    if (!response.ok) throw new Error('Failed to fetch orders');
    const data = await response.json();
    setAvailableOrders(data.orders || []);
  };

  const fetchAssignments = async () => {
    const response = await fetch('/api/admin/assignments');
    if (!response.ok) throw new Error('Failed to fetch assignments');
    const data = await response.json();
    setAssignments(data.assignments || []);
  };

  const handleAssignOrders = async () => {
    if (selectedOrders.length === 0) {
      setError('Please select at least one order');
      return;
    }
    if (!selectedEmployee) {
      setError('Please select an employee');
      return;
    }

    try {
      const response = await fetch('/api/admin/assign-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrders,
          userId: selectedEmployee,
          priority: 0
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Successfully assigned ${data.assigned} orders`);
        setSelectedOrders([]);
        setSelectedEmployee(null);
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(data.error || 'Failed to assign orders');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const getEmployeeStats = (employeeId) => {
    const employeeAssignments = assignments.filter(a => a.assignedToUserId === employeeId);
    const inProgress = employeeAssignments.filter(a => ['assigned', 'picking', 'scanning', 'packing'].includes(a.status)).length;
    const completed = employeeAssignments.filter(a => a.status === 'completed').length;
    return { total: employeeAssignments.length, inProgress, completed };
  };

  if (loading) {
    return (
      <div className="fulfillment-container">
        <div className="dashboard-max-width">
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading admin dashboard...</p>
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
              background: 'linear-gradient(to right, #6366F1, #8B5CF6)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              👔 Admin: Order Assignment
            </h1>
            <p className="dashboard-subtitle">Assign orders to employee stations</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={fetchData} className="btn-white">
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <button onClick={() => navigate('/fulfillment')} className="btn-white">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="alert-success" style={{ marginBottom: '2rem' }}>
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="alert-error" style={{ marginBottom: '2rem' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Employee Stations */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1F2937', marginBottom: '1rem' }}>
            📍 Employee Stations
          </h2>
          <div className="csv-info-grid">
            {employees.map(employee => {
              const stats = getEmployeeStats(employee.id);
              const isSelected = selectedEmployee === employee.id;
              
              return (
                <div
                  key={employee.id}
                  onClick={() => setSelectedEmployee(employee.id)}
                  className="csv-info-card"
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #6366F1' : '1px solid #E5E7EB',
                    background: isSelected ? '#EEF2FF' : 'white',
                    transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div className="csv-info-card-icon" style={{ background: isSelected ? '#6366F1' : '#F3F4F6' }}>
                    <Users size={24} style={{ color: isSelected ? 'white' : '#6366F1' }} />
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1F2937' }}>
                    Station {employee.stationNumber}
                  </h3>
                  <p style={{ color: '#6B7280', marginBottom: '0.5rem' }}>{employee.displayName}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6B7280' }}>
                    <span>In Progress: {stats.inProgress}</span>
                    <span>Completed: {stats.completed}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignment Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Available Orders */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937' }}>
                📦 Available Orders ({availableOrders.length})
              </h2>
              <button
                onClick={() => setSelectedOrders(availableOrders.map(o => o.id))}
                className="btn-white"
                style={{ fontSize: '0.875rem' }}
              >
                Select All
              </button>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {availableOrders.map(order => {
                const isSelected = selectedOrders.includes(order.id);
                const totalItems = order.line_items.reduce((sum, item) => sum + item.quantity, 0);
                
                return (
                  <div
                    key={order.id}
                    onClick={() => toggleOrderSelection(order.id)}
                    style={{
                      padding: '1rem',
                      marginBottom: '0.75rem',
                      border: isSelected ? '2px solid #10B981' : '1px solid #E5E7EB',
                      borderRadius: '0.75rem',
                      background: isSelected ? '#D1FAE5' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h3 style={{ fontWeight: '600', color: '#1F2937' }}>Order {order.name}</h3>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>{order.customer?.email}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: '600', color: '#10B981' }}>
                          ${parseFloat(order.total_price || 0).toFixed(2)}
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                          {totalItems} items
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Assign Button */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '1rem' }}>
              ✅ Assignment Summary
            </h2>
            <div style={{ padding: '2rem', background: '#F9FAFB', borderRadius: '0.75rem', border: '1px solid #E5E7EB' }}>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: '#6B7280', marginBottom: '0.5rem' }}>Selected Employee:</p>
                <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937' }}>
                  {selectedEmployee 
                    ? employees.find(e => e.id === selectedEmployee)?.displayName 
                    : 'None selected'}
                </p>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <p style={{ color: '#6B7280', marginBottom: '0.5rem' }}>Orders Selected:</p>
                <p style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937' }}>
                  {selectedOrders.length}
                </p>
              </div>
              <button
                onClick={handleAssignOrders}
                disabled={selectedOrders.length === 0 || !selectedEmployee}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: selectedOrders.length > 0 && selectedEmployee 
                    ? 'linear-gradient(to right, #10B981, #059669)' 
                    : '#E5E7EB',
                  color: selectedOrders.length > 0 && selectedEmployee ? 'white' : '#9CA3AF',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: selectedOrders.length > 0 && selectedEmployee ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
              >
                Assign {selectedOrders.length} Order{selectedOrders.length !== 1 ? 's' : ''}
              </button>
            </div>

            {/* Current Assignments */}
            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1F2937', marginBottom: '1rem' }}>
                Current Assignments ({assignments.filter(a => a.status !== 'completed').length})
              </h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {assignments
                  .filter(a => a.status !== 'completed')
                  .slice(0, 10)
                  .map(assignment => (
                    <div
                      key={assignment.id}
                      style={{
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'white',
                        border: '1px solid #E5E7EB',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600' }}>{assignment.orderName}</span>
                        <span style={{ 
                          color: assignment.status === 'assigned' ? '#F59E0B' : '#10B981',
                          textTransform: 'capitalize'
                        }}>
                          {assignment.status}
                        </span>
                      </div>
                      <div style={{ color: '#6B7280', marginTop: '0.25rem' }}>
                        {assignment.assignedUser?.displayName} (Station {assignment.assignedUser?.stationNumber})
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;