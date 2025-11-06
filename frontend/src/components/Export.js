// Export.js - Updated for Polaris v13.9.5
// Location: /Export.js

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
  Spinner,
  Badge,
  Select,
  Checkbox,
  TextField,
  Box,
  ProgressBar,
  Banner
} from '@shopify/polaris';

function Export() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    includeImported: true,
    includeNotImported: false,
    includeFailed: false,
    dateRange: 'all',
    startDate: '',
    endDate: ''
  });
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);
  const [projectStats, setProjectStats] = useState({
    totalBackers: 0,
    imported: 0,
    notImported: 0,
    failed: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjectStats();
    // Load export history from localStorage
    const history = JSON.parse(localStorage.getItem(`export-history-${projectId}`) || '[]');
    setExportHistory(history);
  }, [projectId]);

  const fetchProjectStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project/${projectId}/backers`);
      if (!response.ok) throw new Error('Failed to fetch project stats');
      
      const backers = await response.json();
      setProjectStats({
        totalBackers: backers.length,
        imported: backers.filter(b => b.imported).length,
        notImported: backers.filter(b => !b.imported && !b.importError).length,
        failed: backers.filter(b => b.importError).length
      });
    } catch (error) {
      console.error('Error fetching project stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!exportOptions.includeImported && !exportOptions.includeNotImported && !exportOptions.includeFailed) {
      alert('Please select at least one status type to export');
      return;
    }

    setExporting(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        format: exportOptions.format,
        includeImported: exportOptions.includeImported,
        includeNotImported: exportOptions.includeNotImported,
        includeFailed: exportOptions.includeFailed
      });

      if (exportOptions.dateRange !== 'all') {
        if (exportOptions.startDate) params.append('startDate', exportOptions.startDate);
        if (exportOptions.endDate) params.append('endDate', exportOptions.endDate);
      }

      const response = await fetch(`/api/project/${projectId}/export?${params}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename with detailed info
      const timestamp = new Date().toISOString().split('T')[0];
      const statusTypes = [
        exportOptions.includeImported && 'imported',
        exportOptions.includeNotImported && 'pending',
        exportOptions.includeFailed && 'failed'
      ].filter(Boolean).join('-');
      
      link.download = `project-${projectId}-${statusTypes}-${timestamp}.${exportOptions.format}`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Save to export history
      const exportRecord = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        format: exportOptions.format,
        statusTypes,
        filename: link.download
      };
      
      const newHistory = [exportRecord, ...exportHistory.slice(0, 9)]; // Keep last 10
      setExportHistory(newHistory);
      localStorage.setItem(`export-history-${projectId}`, JSON.stringify(newHistory));

      alert(`${exportOptions.format.toUpperCase()} export completed successfully!`);

    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const getEstimatedRecordCount = () => {
    let count = 0;
    if (exportOptions.includeImported) count += projectStats.imported;
    if (exportOptions.includeNotImported) count += projectStats.notImported;
    if (exportOptions.includeFailed) count += projectStats.failed;
    return count;
  };

  const formatOptions = [
    { label: 'CSV', value: 'csv' },
    { label: 'JSON', value: 'json' }
  ];

  const dateRangeOptions = [
    { label: 'All Time', value: 'all' },
    { label: 'Custom Range', value: 'custom' }
  ];

  const primaryAction = {
    content: 'Back to Preview',
    onAction: () => navigate(`/project/${projectId}/preview`),
  };

  if (loading) {
    return (
      <Page title="Export Data" primaryAction={primaryAction}>
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Box padding="800">
                <InlineStack gap="300" align="center">
                  <Spinner size="large" />
                  <Text variant="headingMd">Loading project data...</Text>
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Export Data"
      subtitle="Export project data with advanced filtering options"
      primaryAction={primaryAction}
    >
      <Layout>
        {/* Project Stats */}
        <Layout.Section>
          <Layout>
            <Layout.Section oneQuarter>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Total Backers</Text>
                  <Text variant="headingMd">{projectStats.totalBackers}</Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section oneQuarter>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Imported</Text>
                  <Text variant="headingMd" tone="success">{projectStats.imported}</Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section oneQuarter>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Not Imported</Text>
                  <Text variant="headingMd" tone="critical">{projectStats.notImported}</Text>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section oneQuarter>
              <Card sectioned>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued">Failed</Text>
                  <Text variant="headingMd" tone="warning">{projectStats.failed}</Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </Layout.Section>

        <Layout.Section>
          <Layout>
            {/* Export Options */}
            <Layout.Section oneHalf>
              <Card sectioned>
                <BlockStack gap="400">
                  <Text variant="headingMd">Export Options</Text>

                  {/* Format Selection */}
                  <BlockStack gap="200">
                    <Text variant="headingSm">Export Format</Text>
                    <Select
                      options={formatOptions}
                      value={exportOptions.format}
                      onChange={(value) => setExportOptions(prev => ({ ...prev, format: value }))}
                    />
                  </BlockStack>

                  {/* Status Filter */}
                  <BlockStack gap="200">
                    <Text variant="headingSm">Include Status Types</Text>
                    <BlockStack gap="300">
                      <Checkbox
                        label={`✓ Successfully Imported (${projectStats.imported})`}
                        checked={exportOptions.includeImported}
                        onChange={(checked) => setExportOptions(prev => ({ ...prev, includeImported: checked }))}
                      />
                      <Checkbox
                        label={`✗ Not Imported (${projectStats.notImported})`}
                        checked={exportOptions.includeNotImported}
                        onChange={(checked) => setExportOptions(prev => ({ ...prev, includeNotImported: checked }))}
                      />
                      <Checkbox
                        label={`⚠ Failed Imports (${projectStats.failed})`}
                        checked={exportOptions.includeFailed}
                        onChange={(checked) => setExportOptions(prev => ({ ...prev, includeFailed: checked }))}
                      />
                    </BlockStack>
                  </BlockStack>

                  {/* Date Range */}
                  <BlockStack gap="200">
                    <Text variant="headingSm">Date Range</Text>
                    <Select
                      options={dateRangeOptions}
                      value={exportOptions.dateRange}
                      onChange={(value) => setExportOptions(prev => ({ ...prev, dateRange: value }))}
                    />

                    {exportOptions.dateRange === 'custom' && (
                      <Layout>
                        <Layout.Section oneHalf>
                          <TextField
                            label="Start Date"
                            type="date"
                            value={exportOptions.startDate}
                            onChange={(value) => setExportOptions(prev => ({ ...prev, startDate: value }))}
                          />
                        </Layout.Section>
                        <Layout.Section oneHalf>
                          <TextField
                            label="End Date"
                            type="date"
                            value={exportOptions.endDate}
                            onChange={(value) => setExportOptions(prev => ({ ...prev, endDate: value }))}
                          />
                        </Layout.Section>
                      </Layout>
                    )}
                  </BlockStack>

                  {/* Export Summary */}
                  <Card sectioned subdued>
                    <BlockStack gap="200">
                      <Text variant="headingSm">Export Summary</Text>
                      <Text variant="bodyMd">
                        Format: <Text variant="bodyMd" fontWeight="medium">{exportOptions.format.toUpperCase()}</Text>
                      </Text>
                      <Text variant="bodyMd">
                        Estimated records: <Text variant="bodyMd" fontWeight="medium">{getEstimatedRecordCount()}</Text>
                      </Text>
                    </BlockStack>
                  </Card>

                  {/* Export Button */}
                  <Button
                    variant="primary"
                    size="large"
                    fullWidth
                    onClick={handleExport}
                    disabled={exporting || getEstimatedRecordCount() === 0}
                    loading={exporting}
                  >
                    {exporting ? 'Exporting...' : 'Export Data'}
                  </Button>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Export History */}
            <Layout.Section oneHalf>
              <Card sectioned>
                <BlockStack gap="400">
                  <Text variant="headingMd">Export History</Text>

                  {exportHistory.length === 0 ? (
                    <Box padding="800">
                      <BlockStack gap="400" align="center">
                        <Text variant="bodyMd" tone="subdued">📄</Text>
                        <BlockStack gap="200" align="center">
                          <Text variant="bodyMd" tone="subdued">No exports yet</Text>
                          <Text variant="bodySm" tone="subdued">Your export history will appear here</Text>
                        </BlockStack>
                      </BlockStack>
                    </Box>
                  ) : (
                    <BlockStack gap="200">
                      {exportHistory.map((record) => (
                        <Card key={record.id} sectioned>
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text variant="bodyMd" fontWeight="medium">{record.filename}</Text>
                              <Badge status={record.format === 'csv' ? 'success' : 'info'}>
                                {record.format.toUpperCase()}
                              </Badge>
                            </InlineStack>
                            <Text variant="bodySm">
                              Types: {record.statusTypes}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                              {new Date(record.timestamp).toLocaleString()}
                            </Text>
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default Export;