// Dashboard.js - Polaris with Custom Futuristic Styling + Fulfillment Links
// Location: /frontend/src/components/Dashboard.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Eye,
  MoreVertical,
  Archive,
  Trash2,
  Download,
  FileText,
  BarChart3,
  Users,
  CheckCircle,
  AlertCircle,
  GitMerge,
  Package,
  UserCircle,
  ShieldCheck,
  DollarSign
} from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectStats, setProjectStats] = useState({});
  
  // Export functionality state
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [exporting, setExporting] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      const data = await response.json();
      setProjects(data);
      setError(null);
      
      // Fetch stats for each project
      await fetchProjectStats(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectStats = async (projectList) => {
    const stats = {};
    for (const project of projectList) {
      try {
        const response = await fetch(`/api/project/${project.id}/report`);
        if (response.ok) {
          const data = await response.json();
          stats[project.id] = data;
        } else {
          stats[project.id] = {
            total: 0,
            imported: 0,
            pending: 0,
            failed: 0
          };
        }
      } catch (err) {
        stats[project.id] = {
          total: 0,
          imported: 0,
          pending: 0,
          failed: 0
        };
      }
    }
    setProjectStats(stats);
  };

  const handleViewProject = async (projectId) => {
  try {
    // Check if project has mappings
    const mappingsResponse = await fetch(`/api/projects/${projectId}/mappings`);
    
    if (mappingsResponse.ok) {
      const mappings = await mappingsResponse.json();
      
      // If mappings exist and there are backers, go to report
      const stats = projectStats[projectId];
      if (mappings && mappings.length > 0 && stats && stats.total > 0) {
        navigate(`/project/${projectId}/report`);
        return;
      }
    }
    
    // Otherwise, start from upload
    navigate(`/project/${projectId}/upload`);
    
  } catch (error) {
    console.error('Error checking project state:', error);
    // Default to upload on error
    navigate(`/project/${projectId}/upload`);
  }
};

  const handleCreateProject = async () => {
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Project ${Date.now()}` })
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    const newProject = await response.json();
    setProjects([...projects, newProject]);
    navigate(`/project/${newProject.id}/upload`);
  } catch (err) {
    console.error('Error creating project:', err);
    setError(`Failed to create project: ${err.message}`);
  }
};

  const startEdit = (project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setActiveMenu(null);
  };

  const saveEdit = async (id) => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      setProjects(projects.map(p => p.id === id ? { ...p, name: editName } : p));
      setEditingId(null);
      setEditName('');
    } catch (err) {
      console.error('Error updating project:', err);
      alert(`Failed to update project: ${err.message}`);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleAction = async (action, projectId) => {
    setActiveMenu(null);

    switch(action) {
      case 'delete':
        if (window.confirm('Delete this project? This action cannot be undone.')) {
          try {
            const response = await fetch(`/api/projects/${projectId}`, {
              method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete');
            setProjects(projects.filter(p => p.id !== projectId));
          } catch (err) {
            alert(`Failed to delete: ${err.message}`);
          }
        }
        break;

      case 'reset':
        if (window.confirm('Reset project data? This will clear all uploaded CSV data and mappings.')) {
          try {
            const response = await fetch(`/api/projects/${projectId}/reset`, {
              method: 'POST'
            });
            if (!response.ok) throw new Error('Failed to reset');
            alert('Project data reset successfully');
            fetchProjects();
          } catch (err) {
            alert(`Failed to reset: ${err.message}`);
          }
        }
        break;

      default:
        break;
    }
  };

  // Export functionality
  const handleProjectSelect = (projectId) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (selectedProjects.size === filtered.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filtered.map(p => p.id)));
    }
  };

  const handleBulkExport = async () => {
    if (selectedProjects.size === 0) {
      alert('Please select at least one project to export');
      return;
    }

    setExporting(true);
    try {
      const response = await fetch('/api/projects/bulk-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectIds: Array.from(selectedProjects),
          format: 'csv'
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.download = `projects-export-${timestamp}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSelectedProjects(new Set());
      alert(`Successfully exported ${selectedProjects.size} projects!`);

    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const getSuccessRate = (stats) => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.imported / stats.total) * 100);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-max-width">
          <div className="text-center" style={{ padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <div style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading projects...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-max-width">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Kickstarter Projects</h1>
            <p className="dashboard-subtitle">Create, Edit, Delete projects here.</p>
          </div>
          <div className="dashboard-actions">
            <button
              onClick={() => navigate('/customer-merge')}
              className="btn-gradient-secondary"
            >
              <GitMerge size={18} />
              <span>Merge Customers</span>
            </button>
            <button
              onClick={handleSelectAll}
              className="btn-white"
            >
              <FileText size={18} />
              <span>{selectedProjects.size === filteredProjects.length ? 'Deselect All' : 'Export Projects'}</span>
            </button>
            <button
              onClick={handleCreateProject}
              className="btn-gradient-primary"
            >
              <Plus size={20} />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* NEW: Fulfillment System Quick Access - ONLY ADDITION */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem',
          color: 'white'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
            📦 Order Management
          </h2>
          <p style={{ marginBottom: '1.5rem', opacity: 0.9 }}>
            Manage draft orders, fulfillment, picking, scanning, and shipping with dedicated employee stations
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <button
              onClick={() => navigate('/mark-as-paid')}
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <DollarSign size={24} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '600' }}>Mark as Paid</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Process draft orders</div>
            </button>
            <button
              onClick={() => navigate('/fulfillment')}
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <Package size={24} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '600' }}>Orders</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>View ready to ship</div>
            </button>
            <button
              onClick={() => navigate('/fulfillment/admin')}
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <ShieldCheck size={24} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '600' }}>Admin</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Assign orders</div>
            </button>
            <button
              onClick={() => navigate('/employee/1')}
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <UserCircle size={24} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '600' }}>Station 1</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Employee view</div>
            </button>
            <button
              onClick={() => navigate('/employee/2')}
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <UserCircle size={24} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '600' }}>Station 2</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Employee view</div>
            </button>
            {/* ADDED BACK STATION 3 */}
            <button
              onClick={() => navigate('/employee/3')}
              style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '0.5rem',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              <UserCircle size={24} style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '600' }}>Station 3</div>
              <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>Employee view</div>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert-error">
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="dashboard-search">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Export Selection Info */}
        {selectedProjects.size > 0 && (
          <div className="alert-info">
            <div className="alert-info-content">
              <span className="alert-info-text">
                {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected for export
              </span>
              <button
                onClick={() => setSelectedProjects(new Set())}
                className="alert-clear-btn"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <h2 className="empty-state-title">No projects yet</h2>
            <p className="empty-state-text">Create your first project to get started</p>
            <button
              onClick={handleCreateProject}
              className="btn-gradient-primary"
            >
              <Plus size={20} />
              <span>Create Project</span>
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {filteredProjects.map(project => {
              const stats = projectStats[project.id] || { total: 0, imported: 0, pending: 0, failed: 0 };
              const successRate = getSuccessRate(stats);
              
              return (
                <div
                  key={project.id}
                  className={`project-card ${selectedProjects.has(project.id) ? 'selected' : ''}`}
                >
                  {/* Export Checkbox */}
                  <div className="project-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => handleProjectSelect(project.id)}
                    />
                  </div>

                  {/* Action Menu */}
                  <div className="project-menu">
                    <button
                      onClick={() => setActiveMenu(activeMenu === project.id ? null : project.id)}
                      className="project-menu-btn"
                    >
                      <MoreVertical size={20} />
                    </button>
                    
                    {activeMenu === project.id && (
                      <div className="project-menu-dropdown">
                        <button
                          onClick={() => startEdit(project)}
                          className="project-menu-item"
                        >
                          <Pencil size={16} />
                          Rename
                        </button>
                        <button
                          onClick={() => handleAction('reset', project.id)}
                          className="project-menu-item warning"
                        >
                          <Archive size={16} />
                          Reset Data
                        </button>
                        <button
                          onClick={() => handleAction('delete', project.id)}
                          className="project-menu-item danger"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Project Content */}
                  <div className="project-card-content">
                    {editingId === project.id ? (
                      <div>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="project-edit-input"
                          autoFocus
                        />
                        <div className="project-edit-actions">
                          <button
                            onClick={() => saveEdit(project.id)}
                            className="project-edit-save"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="project-edit-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="project-name">{project.name}</h3>
                        <p className="project-date">
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </>
                    )}

                    {/* Status Badge */}
                    <div className="project-status-badge">
                      {project.status || 'Active'}
                    </div>

                    {/* Report Preview */}
                    {stats.total > 0 && (
                      <div className="project-stats">
                        <div className="project-stats-header">
                          <h4 className="project-stats-title">
                            <BarChart3 size={16} />
                            Import Summary
                          </h4>
                          <button
                            onClick={() => navigate(`/project/${project.id}/report`)}
                            className="project-stats-link"
                          >
                            View Full Report
                          </button>
                        </div>
                        <div className="project-stats-grid">
                          <div className="project-stat-item">
                            <div className="project-stat-value">
                              <Users size={12} />
                              <span>{stats.total}</span>
                            </div>
                            <p className="project-stat-label">Total</p>
                          </div>
                          <div className="project-stat-item">
                            <div className="project-stat-value" style={{ color: '#059669' }}>
                              <CheckCircle size={12} />
                              <span>{stats.imported}</span>
                            </div>
                            <p className="project-stat-label">Imported</p>
                          </div>
                          <div className="project-stat-item">
                            <div className="project-stat-value" style={{ color: '#F97316' }}>
                              <AlertCircle size={12} />
                              <span>{stats.failed}</span>
                            </div>
                            <p className="project-stat-label">Failed</p>
                          </div>
                        </div>
                        <div className="project-success-rate">
                          <span className={
                            successRate >= 80 ? 'success-rate-high' :
                            successRate >= 50 ? 'success-rate-medium' :
                            'success-rate-low'
                          }>
                            {successRate}% Success Rate
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="project-actions">
                      <button
                        onClick={() => handleViewProject(project.id)}
                        className="project-btn-primary"
                      >
                        <Eye size={18} />
                        <span>View Project</span>
                      </button>
                      
                      {stats.total > 0 && (
                        <button
                          onClick={() => navigate(`/project/${project.id}/report`)}
                          className="project-btn-secondary"
                        >
                          <BarChart3 size={16} />
                          <span>View Report</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Fixed Export Button */}
        {selectedProjects.size > 0 && (
          <div className="fixed-export-button">
            <button
              onClick={handleBulkExport}
              disabled={exporting}
              className="export-button"
            >
              {exporting ? (
                <>
                  <div className="loading-spinner"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={24} />
                  <span>Export Now ({selectedProjects.size})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;