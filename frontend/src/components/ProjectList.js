// ProjectList.js - Updated for Polaris v13.9.5
// Location: /ProjectList.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Badge,
  TextField,
  Modal,
  TextContainer,
  Text,
  Checkbox,
  ActionList,
  Popover,
  Banner,
  EmptyState,
  ResourceList,
  SkeletonBodyText,
  SkeletonDisplayText
} from '@shopify/polaris';
import {
  EditIcon,
  DeleteIcon,
  MenuHorizontalIcon,
  ViewIcon,
  ChartVerticalIcon
} from '@shopify/polaris-icons';

function ProjectList({ 
  projects = [], 
  onUpdate = () => {}, 
  loading = false, 
  searchTerm = '', 
  projectStats = {},
  selectedProjects = new Set(),
  onToggleProject = () => {},
  onSelectAll = () => {},
  showSelection = false
}) {
  const navigate = useNavigate();
  const [activePopover, setActivePopover] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, project: null });

  // Filter projects based on search term
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setActivePopover(null);
  };

  const handleSaveEdit = async (projectId) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      });

      if (response.ok) {
        onUpdate(projectId);
        setEditingId(null);
        setEditName('');
      } else {
        throw new Error('Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert(`Failed to update project: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.project) return;

    try {
      const response = await fetch(`/api/projects/${deleteModal.project.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        onUpdate();
        setDeleteModal({ open: false, project: null });
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(`Failed to delete project: ${error.message}`);
    }
  };

  const getStatusBadge = (stats) => {
    if (!stats || stats.total === 0) {
      return <Badge status="attention">No Data</Badge>;
    }
    
    if (stats.imported === stats.total) {
      return <Badge status="success">Complete</Badge>;
    } else if (stats.failed > 0) {
      return <Badge status="warning">Partial</Badge>;
    } else {
      return <Badge status="info">In Progress</Badge>;
    }
  };

  const getSuccessRate = (stats) => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.imported / stats.total) * 100);
  };

  if (loading) {
    const skeletonItems = Array.from({ length: 6 }, (_, index) => ({
      id: `skeleton-${index}`,
    }));

    return (
      <Card>
        <ResourceList
          items={skeletonItems}
          renderItem={() => (
            <ResourceList.Item>
              <div style={{ padding: '16px' }}>
                <SkeletonDisplayText size="small" />
                <br />
                <SkeletonBodyText lines={2} />
              </div>
            </ResourceList.Item>
          )}
        />
      </Card>
    );
  }

  if (filteredProjects.length === 0) {
    return (
      <Card>
        <EmptyState
          heading={searchTerm ? 'No projects found' : 'No projects yet'}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            {searchTerm 
              ? `No projects match "${searchTerm}"`
              : 'Get started by creating your first Kickstarter import project.'
            }
          </p>
        </EmptyState>
      </Card>
    );
  }

  // Create resource list items from projects
  const resourceListItems = filteredProjects.map(project => {
    const stats = projectStats[project.id] || {};
    const successRate = getSuccessRate(stats);
    
    return {
      id: project.id,
      project,
      stats,
      successRate
    };
  });

  return (
    <div>
      {/* Select All Banner */}
      {showSelection && selectedProjects.size > 0 && (
        <Banner 
          status="info"
          action={{
            content: 'Clear Selection',
            onAction: () => onToggleProject(new Set())
          }}
        >
          <p>
            {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected for export
          </p>
        </Banner>
      )}

      {/* Select All Checkbox */}
      {showSelection && (
        <Card>
          <Card.Section>
            <Checkbox
              label={`Select All (${selectedProjects.size} selected)`}
              checked={selectedProjects.size === filteredProjects.length && filteredProjects.length > 0}
              onChange={onSelectAll}
            />
          </Card.Section>
        </Card>
      )}

      {/* Projects Resource List */}
      <Card>
        <ResourceList
          items={resourceListItems}
          selectedItems={showSelection ? Array.from(selectedProjects) : []}
          onSelectionChange={showSelection ? (selectedItems) => {
            selectedItems.forEach(id => onToggleProject(parseInt(id)));
          } : undefined}
          selectable={showSelection}
          renderItem={(item) => {
            const { project, stats, successRate } = item;
            
            const popoverActivator = (
              <Button
                icon={MenuHorizontalIcon}
                onClick={() => setActivePopover(activePopover === project.id ? null : project.id)}
                plain
              />
            );

            return (
              <ResourceList.Item
                id={project.id}
                accessibilityLabel={`Project ${project.name}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ flex: 1 }}>
                    {/* Project Name - Inline Editing */}
                    {editingId === project.id ? (
                      <div style={{ marginBottom: '16px' }}>
                        <TextField
                          value={editName}
                          onChange={setEditName}
                          onBlur={() => handleSaveEdit(project.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(project.id);
                            if (e.key === 'Escape') {
                              setEditingId(null);
                              setEditName('');
                            }
                          }}
                          autoFocus
                        />
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                          <Button
                            primary
                            size="slim"
                            onClick={() => handleSaveEdit(project.id)}
                          >
                            Save
                          </Button>
                          <Button
                            size="slim"
                            onClick={() => {
                              setEditingId(null);
                              setEditName('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom: '16px' }}>
                        <Text as="h3" variant="headingMd">{project.name}</Text>
                        <p style={{ color: '#6D7175', fontSize: '14px', marginTop: '4px' }}>
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div style={{ marginBottom: '16px' }}>
                      {getStatusBadge(stats)}
                    </div>

                    {/* Stats Preview */}
                    {stats.total > 0 && (
                      <Card>
                        <Card.Section>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <Text as="h4" variant="headingSm">Import Summary</Text>
                            <Button
                              plain
                              size="slim"
                              onClick={() => navigate(`/project/${project.id}/report`)}
                            >
                              View Full Report
                            </Button>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', textAlign: 'center' }}>
                            <div>
                              <p style={{ fontWeight: 'bold', fontSize: '18px' }}>{stats.total}</p>
                              <p style={{ color: '#6D7175', fontSize: '12px' }}>Total</p>
                            </div>
                            <div>
                              <p style={{ fontWeight: 'bold', fontSize: '18px', color: '#00848E' }}>{stats.imported}</p>
                              <p style={{ color: '#6D7175', fontSize: '12px' }}>Imported</p>
                            </div>
                            <div>
                              <p style={{ fontWeight: 'bold', fontSize: '18px', color: '#BF0711' }}>{stats.failed}</p>
                              <p style={{ color: '#6D7175', fontSize: '12px' }}>Failed</p>
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'center', marginTop: '12px' }}>
                            <Badge status={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'critical'}>
                              {successRate}% Success Rate
                            </Badge>
                          </div>
                        </Card.Section>
                      </Card>
                    )}

                    {/* Action Buttons */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <Button
                        primary
                        fullWidth
                        icon={ViewIcon}
                        onClick={() => navigate(`/project/${project.id}/upload`)}
                      >
                        View Project
                      </Button>
                      
                      {stats.total > 0 && (
                        <Button
                          fullWidth
                          icon={ChartVerticalIcon}
                          onClick={() => navigate(`/project/${project.id}/report`)}
                        >
                          View Report
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Action Menu */}
                  <div style={{ marginLeft: '16px' }}>
                    <Popover
                      active={activePopover === project.id}
                      activator={popoverActivator}
                      onClose={() => setActivePopover(null)}
                      ariaHaspopup={false}
                      sectioned
                    >
                      <ActionList
                        actionRole="menuitem"
                        items={[
                          {
                            content: 'Edit Name',
                            icon: EditIcon,
                            onAction: () => handleEdit(project)
                          },
                          {
                            content: 'View Details', 
                            icon: ViewIcon,
                            onAction: () => navigate(`/project/${project.id}/upload`)
                          },
                          ...(stats.total > 0 ? [{
                            content: 'View Report',
                            icon: ChartVerticalIcon,
                            onAction: () => navigate(`/project/${project.id}/report`)
                          }] : []),
                          {
                            content: 'Delete Project',
                            icon: DeleteIcon,
                            destructive: true,
                            onAction: () => setDeleteModal({ open: true, project })
                          }
                        ]}
                      />
                    </Popover>
                  </div>
                </div>
              </ResourceList.Item>
            );
          }}
        />
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, project: null })}
        title="Delete Project"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: handleDelete,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setDeleteModal({ open: false, project: null }),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>
              Are you sure you want to delete "{deleteModal.project?.name}"? This action cannot be undone.
            </p>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </div>
  );
}

export default ProjectList;