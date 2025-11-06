// ImportPreview.js - CORRECT VERSION - Select backers for import
// Location: /frontend/src/components/ImportPreview.js

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
  DataTable,
  Banner,
  Box,
  Checkbox
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  ArrowLeftIcon
} from '@shopify/polaris-icons';

function ImportPreview() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [backers, setBackers] = useState([]);
  const [selectedBackers, setSelectedBackers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('ImportPreview: Loading backers for project', projectId);
    fetchBackers();
  }, [projectId]);

  const fetchBackers = async () => {
    try {
      setLoading(true);
      console.log('Fetching backers from /api/projects/${projectId}/backers');
      const response = await fetch(`/api/projects/${projectId}/backers`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch backers');
      }
      
      const data = await response.json();
      console.log(`Loaded ${data.length} backers`);
      setBackers(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching backers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (backerId) => {
    setSelectedBackers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(backerId)) {
        newSet.delete(backerId);
      } else {
        newSet.add(backerId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const unimportedBackers = backers.filter(b => !b.imported);
    if (selectedBackers.size === unimportedBackers.length) {
      setSelectedBackers(new Set());
    } else {
      setSelectedBackers(new Set(unimportedBackers.map(b => b.id)));
    }
  };

  const handleImport = async () => {
    if (selectedBackers.size === 0) {
      alert('Please select at least one backer to import');
      return;
    }

    console.log('Starting import for', selectedBackers.size, 'backers');
    setImporting(true);
    
    try {
      const response = await fetch(`/api/project/${projectId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          selectedBackerIds: Array.from(selectedBackers) 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      console.log('Import results:', data.results);
      
      // Show results
      alert(
        `Import Complete!\n\n` +
        `✓ Successful: ${data.results?.successful || 0}\n` +
        `✗ Failed: ${data.results?.failed || 0}\n` +
        `⊘ Skipped: ${data.results?.skipped || 0}`
      );
      
      // Refresh backers to show updated status
      await fetchBackers();
      
      // Clear selections
      setSelectedBackers(new Set());
      
      // Navigate to report to see details
      navigate(`/project/${projectId}/report`);
      
    } catch (error) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const getStatusDisplay = (backer) => {
    if (backer.imported) {
      return {
        text: 'Imported',
        status: 'success',
        icon: CheckCircleIcon
      };
    } else if (backer.importError) {
      return {
        text: 'Failed',
        status: 'critical',
        icon: XCircleIcon,
        error: backer.importError
      };
    } else {
      return {
        text: 'Pending',
        status: 'info',
        icon: AlertCircleIcon
      };
    }
  };

  const unimportedCount = backers.filter(b => !b.imported).length;
  const importedCount = backers.filter(b => b.imported).length;
  const failedCount = backers.filter(b => b.importError).length;

  // Create table rows
  const tableRows = backers.map((backer) => {
    const status = getStatusDisplay(backer);
    return [
      <Checkbox
        key={`checkbox-${backer.id}`}
        checked={selectedBackers.has(backer.id)}
        onChange={() => handleToggleSelect(backer.id)}
        disabled={backer.imported}
      />,
      backer.backerNumber || 'N/A',
      backer.name || 'N/A',
      backer.email || 'N/A',
      `$${backer.pledgeAmount || 0}`,
      <Badge key={`badge-${backer.id}`} status={status.status}>
        {status.text}
      </Badge>,
      backer.shopifyOrderNumber || '-'
    ];
  });

  const primaryAction = {
    content: importing ? 'Importing...' : `Import Selected (${selectedBackers.size})`,
    onAction: handleImport,
    disabled: selectedBackers.size === 0 || importing,
    loading: importing
  };

  const secondaryActions = [
    {
      content: 'Select All Pending',
      onAction: handleSelectAll,
    },
    {
      content: 'View Report',
      onAction: () => navigate(`/project/${projectId}/report`),
    },
    {
      content: 'Back to Mapping',
      onAction: () => navigate(`/project/${projectId}/mapping`),
    },
    {
      content: 'Dashboard',
      icon: ArrowLeftIcon,
      onAction: () => navigate('/dashboard'),
    },
  ];

  if (loading) {
    return (
      <Page title="Import Preview">
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <Box padding="800">
                <InlineStack gap="300" align="center">
                  <Spinner size="large" />
                  <Text variant="headingMd">Loading backers...</Text>
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page
        title="Import Preview"
        secondaryActions={secondaryActions}
      >
        <Layout>
          <Layout.Section>
            <Banner status="critical">
              <Text as="p">Error loading backers: {error}</Text>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Import Preview"
      subtitle={`Select backers to import to Shopify (${unimportedCount} pending, ${importedCount} imported, ${failedCount} failed)`}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Layout>
        {/* Summary Stats */}
        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">Total Backers</Text>
                  <Text as="p" variant="headingLg">{backers.length}</Text>
                </BlockStack>
              </Box>
            </Card>
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">Pending Import</Text>
                  <Text as="p" variant="headingLg" tone="info">{unimportedCount}</Text>
                </BlockStack>
              </Box>
            </Card>
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">Already Imported</Text>
                  <Text as="p" variant="headingLg" tone="success">{importedCount}</Text>
                </BlockStack>
              </Box>
            </Card>
            <Card>
              <Box padding="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">Failed</Text>
                  <Text as="p" variant="headingLg" tone="critical">{failedCount}</Text>
                </BlockStack>
              </Box>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Selection Info */}
        {selectedBackers.size > 0 && (
          <Layout.Section>
            <Banner status="info">
              <Text as="p">
                {selectedBackers.size} backer{selectedBackers.size !== 1 ? 's' : ''} selected for import
              </Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Backers Table */}
        <Layout.Section>
          <Card>
            <DataTable
              columnContentTypes={[
                'text',
                'text',
                'text',
                'text',
                'numeric',
                'text',
                'text'
              ]}
              headings={[
                <Checkbox
                  key="select-all"
                  checked={selectedBackers.size === unimportedCount && unimportedCount > 0}
                  onChange={handleSelectAll}
                  label="Select All"
                  labelHidden
                />,
                'Backer #',
                'Name',
                'Email',
                'Pledge',
                'Status',
                'Shopify Order'
              ]}
              rows={tableRows}
              hasZebraStriping
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default ImportPreview;