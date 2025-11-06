// ImportReport.js - Fixed to correctly display import status
// Location: /frontend/src/components/ImportReport.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  InlineStack,
  BlockStack,
  Icon,
  Spinner,
  Badge,
  DataTable,
  Banner,
  Box
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  InfoIcon,
  ArrowLeftIcon,
  ExportIcon
} from '@shopify/polaris-icons';

function ImportReport() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [projectId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project/${projectId}/report`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch report');
      }
      
      const data = await response.json();
      console.log('Report data:', data); // Debug log
      setReportData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const response = await fetch(`/api/project/${projectId}/export?format=csv`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-report-project-${projectId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export CSV');
    }
  };
  
  const handleClearAndReset = async () => {
  try {
    setResetting(true);
    
    // Delete all backers for this project
    const deleteBackersResponse = await fetch(`/api/projects/${projectId}/backers`, {
      method: 'DELETE'
    });
    
    if (!deleteBackersResponse.ok) {
      throw new Error('Failed to delete backers');
    }
    
    // Delete all mappings for this project
    const deleteMappingsResponse = await fetch(`/api/projects/${projectId}/mappings`, {
      method: 'DELETE'
    });
    
    if (!deleteMappingsResponse.ok) {
      throw new Error('Failed to delete mappings');
    }
    
    // Update project to clear CSV file reference
    const updateProjectResponse = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvFile: null, csvFilePath: null })
    });
    
    if (!updateProjectResponse.ok) {
      throw new Error('Failed to update project');
    }
    
    // Navigate back to upload page
    navigate(`/project/${projectId}/upload`);
    
  } catch (error) {
    console.error('Reset error:', error);
    alert(`Failed to reset project: ${error.message}`);
  } finally {
    setResetting(false);
    setShowResetConfirm(false);
  }
};

  const getStatusBadge = (detail) => {
    if (detail.imported) {
      return <Badge status="success">Imported</Badge>;
    } else if (detail.error) {
      return <Badge status="critical">Failed</Badge>;
    } else {
      return <Badge status="info">Pending</Badge>;
    }
  };

  const getStatusIcon = (detail) => {
    if (detail.imported) {
      return <Icon source={CheckCircleIcon} tone="success" />;
    } else if (detail.error) {
      return <Icon source={XCircleIcon} tone="critical" />;
    } else {
      return <Icon source={AlertCircleIcon} tone="warning" />;
    }
  };

  const primaryAction = {
    content: 'Back to Dashboard',
    icon: ArrowLeftIcon,
    onAction: () => navigate('/dashboard'),
  };

  const secondaryActions = [
  {
    content: 'Return to Mapping',
    onAction: () => navigate(`/project/${projectId}/mapping`),
  },
  {
    content: 'Clear & Reset',
    destructive: true,
    onAction: () => setShowResetConfirm(true),
  },
  {
    content: 'Export CSV',
    icon: ExportIcon,
    onAction: exportCSV,
  },
  {
    content: 'Back to Preview',
    onAction: () => navigate(`/project/${projectId}/preview`),
  }
];

  if (loading) {
    return (
      <Page title="Import Report">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <BlockStack gap="400">
                <Spinner size="small" />
                <Text as="p">Loading import report...</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page
        title="Import Report"
        primaryAction={primaryAction}
      >
        <Layout>
          <Layout.Section>
            <Banner status="critical">
              <Text as="p">Error loading report: {error}</Text>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (!reportData || !reportData.details) {
    return (
      <Page
        title="Import Report"
        primaryAction={primaryAction}
      >
        <Layout>
          <Layout.Section>
            <Banner status="info">
              <Text as="p">No report data available</Text>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  // Create summary stats
  const summaryRows = [
    [
      <InlineStack gap="200">
        <Icon source={InfoIcon} tone="base" />
        <Text as="span">Total Backers</Text>
      </InlineStack>,
      reportData.total || 0
    ],
    [
      <InlineStack gap="200">
        <Icon source={CheckCircleIcon} tone="success" />
        <Text as="span">Successfully Imported</Text>
      </InlineStack>,
      reportData.imported || 0
    ],
    [
      <InlineStack gap="200">
        <Icon source={AlertCircleIcon} tone="warning" />
        <Text as="span">Pending Import</Text>
      </InlineStack>,
      reportData.pending || 0
    ],
    [
      <InlineStack gap="200">
        <Icon source={XCircleIcon} tone="critical" />
        <Text as="span">Failed Imports</Text>
      </InlineStack>,
      reportData.failed || 0
    ]
  ];

  // Create detail rows
  const detailRows = reportData.details.map((detail) => [
    <InlineStack gap="200">
      {getStatusIcon(detail)}
      <Text as="span">{detail.backerNumber || 'N/A'}</Text>
    </InlineStack>,
    detail.name || 'N/A',
    detail.email || 'N/A',
    getStatusBadge(detail),
    detail.shopifyOrderNumber || '-',
    detail.error || (detail.imported ? 'Successfully imported' : 'Not yet imported')
  ]);

  const successRate = reportData.total > 0 
    ? Math.round((reportData.imported / reportData.total) * 100) 
    : 0;

  return (
    <Page
      title="Import Report"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Layout>
        {/* Success Rate Banner */}
        {reportData.total > 0 && (
          <Layout.Section>
            <Banner
              status={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'critical'}
            >
              <Text as="p">
                Import Success Rate: <strong>{successRate}%</strong> ({reportData.imported} of {reportData.total} backers imported)
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Summary Statistics */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Import Summary</Text>
              <DataTable
                columnContentTypes={['text', 'numeric']}
                headings={['Metric', 'Count']}
                rows={summaryRows}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Detailed Results */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Import Details</Text>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={[
                  'Backer #',
                  'Name',
                  'Email',
                  'Status',
                  'Shopify Order',
                  'Message'
                ]}
                rows={detailRows}
                hasZebraStriping
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Failed Imports Section */}
        {reportData.failed > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Failed Imports ({reportData.failed})</Text>
                <Text as="p" tone="subdued">
                  The following backers failed to import. Review the error messages and retry after fixing the issues.
                </Text>
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text']}
                  headings={['Backer #', 'Name', 'Email', 'Error']}
                  rows={reportData.details
                    .filter(d => d.error)
                    .map(detail => [
                      detail.backerNumber || 'N/A',
                      detail.name || 'N/A',
                      detail.email || 'N/A',
                      detail.error || 'Unknown error'
                    ])}
                  hasZebraStriping
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)'
          }}>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Clear Project Data?</Text>
              
              <Text as="p">This will permanently delete:</Text>
              
              <BlockStack gap="200">
                <Text as="p">• All backer data ({reportData.total} backers)</Text>
                <Text as="p">• All product mappings</Text>
                <Text as="p">• CSV file reference</Text>
              </BlockStack>
              
              <Text as="p" tone="subdued">
                This action cannot be undone. You'll be redirected to the upload page to start fresh.
              </Text>
              
              <InlineStack gap="300">
                <Button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  tone="critical"
                  onClick={handleClearAndReset}
                  loading={resetting}
                >
                  Clear & Reset
                </Button>
              </InlineStack>
            </BlockStack>
          </div>
        </div>
      )}
      
    </Page>
  );
}

export default ImportReport;