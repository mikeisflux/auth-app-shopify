// BackerPreview.js - Updated for Polaris v13
// Location: /frontend/src/BackerPreview.js

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
  TextField,
  DataTable,
  Checkbox,
  Collapsible,
  Box,
  Divider
} from '@shopify/polaris';
import {
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@shopify/polaris-icons';

function BackerPreview() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [backers, setBackers] = useState([]);
  const [filteredBackers, setFilteredBackers] = useState([]);
  const [selectedBackers, setSelectedBackers] = useState(new Set());
  const [expandedBackers, setExpandedBackers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBackers();
  }, [projectId]);

  useEffect(() => {
    // Filter backers based on search term
    if (searchTerm === '') {
      setFilteredBackers(backers);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = backers.filter(backer => {
        return (
          backer.backerNumber?.toString().includes(term) ||
          backer.name?.toLowerCase().includes(term) ||
          backer.email?.toLowerCase().includes(term) ||
          backer.pledgeAmount?.toString().includes(term) ||
          backer.shippingCity?.toLowerCase().includes(term) ||
          backer.shippingCountry?.toLowerCase().includes(term) ||
          JSON.stringify(backer).toLowerCase().includes(term)
        );
      });
      setFilteredBackers(filtered);
    }
  }, [searchTerm, backers]);

  const fetchBackers = async () => {
    try {
      const response = await fetch(`/api/project/${projectId}/backers`);
      const data = await response.json();
      
      // Sort backers by number (numeric sort)
      const sorted = data.sort((a, b) => {
        const numA = parseInt(a.backerNumber) || 0;
        const numB = parseInt(b.backerNumber) || 0;
        return numA - numB;
      });
      
      setBackers(sorted);
      setFilteredBackers(sorted);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching backers:', error);
      setLoading(false);
    }
  };

  const toggleBacker = (backerId) => {
    const newSelected = new Set(selectedBackers);
    if (newSelected.has(backerId)) {
      newSelected.delete(backerId);
    } else {
      newSelected.add(backerId);
    }
    setSelectedBackers(newSelected);
  };

  const toggleExpanded = (backerId) => {
    const newExpanded = new Set(expandedBackers);
    if (newExpanded.has(backerId)) {
      newExpanded.delete(backerId);
    } else {
      newExpanded.add(backerId);
    }
    setExpandedBackers(newExpanded);
  };

  const selectAll = () => {
    setSelectedBackers(new Set(filteredBackers.map(b => b.id)));
  };

  const deselectAll = () => {
    setSelectedBackers(new Set());
  };

  const handleImport = async () => {
    const selectedIds = Array.from(selectedBackers);
    if (selectedIds.length === 0) {
      alert('Please select at least one backer to import');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`/api/project/${projectId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backerIds: selectedIds })
      });

      if (response.ok) {
        navigate(`/project/${projectId}/report`);
      } else {
        const error = await response.json();
        alert(`Import failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const totalPledgeAmount = filteredBackers
    .filter(b => selectedBackers.has(b.id))
    .reduce((sum, b) => sum + (parseFloat(b.pledgeAmount) || 0), 0);

  const primaryAction = {
    content: importing ? 'Importing...' : `Import ${selectedBackers.size} Selected Backer${selectedBackers.size !== 1 ? 's' : ''}`,
    onAction: handleImport,
    disabled: selectedBackers.size === 0 || importing,
    loading: importing
  };

  if (loading) {
    return (
      <Page title="Loading Backers">
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

  return (
    <Page
      title="Preview & Select Backers"
      subtitle="Review backers and select which ones to import to Shopify"
      primaryAction={primaryAction}
    >
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="300">
              <TextField
                prefix={<Icon source={SearchIcon} />}
                placeholder="Search backers by number, name, email, amount, location..."
                value={searchTerm}
                onChange={setSearchTerm}
                clearButton
                onClearButtonClick={() => setSearchTerm('')}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <InlineStack gap="600">
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Showing:</Text>
                    <Text variant="bodyMd" fontWeight="medium">
                      {filteredBackers.length}
                      {searchTerm && (
                        <Text variant="bodySm" tone="subdued" as="span">
                          {' '}(of {backers.length} total)
                        </Text>
                      )}
                    </Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Selected:</Text>
                    <Text variant="bodyMd" fontWeight="medium">{selectedBackers.size}</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="bodySm" tone="subdued">Total Pledge Amount:</Text>
                    <Text variant="bodyMd" fontWeight="medium" tone="success">
                      ${totalPledgeAmount.toFixed(2)}
                    </Text>
                  </BlockStack>
                </InlineStack>
                <InlineStack gap="200">
                  <Button onClick={selectAll}>Select All Visible</Button>
                  <Button onClick={deselectAll}>Deselect All</Button>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              {filteredBackers.map((backer) => (
                <div key={backer.id}>
                  <Box padding="300">
                    <InlineStack align="start" gap="300">
                      <Checkbox
                        checked={selectedBackers.has(backer.id)}
                        onChange={() => toggleBacker(backer.id)}
                      />
                      <Button
                        variant="plain"
                        onClick={() => toggleExpanded(backer.id)}
                        icon={expandedBackers.has(backer.id) ? ChevronDownIcon : ChevronRightIcon}
                      />
                      <InlineStack align="space-between" blockAlign="start" gap="400">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="medium">
                            #{backer.backerNumber} - {backer.name}
                          </Text>
                          <Text variant="bodySm" tone="subdued">{backer.email}</Text>
                        </BlockStack>
                        <BlockStack gap="100" align="end">
                          <Text variant="bodyMd" fontWeight="medium" tone="success">
                            ${parseFloat(backer.pledgeAmount || 0).toFixed(2)}
                          </Text>
                          {backer.imported && (
                            <Badge status="success">Imported</Badge>
                          )}
                        </BlockStack>
                      </InlineStack>
                    </InlineStack>

                    <Collapsible
                      open={expandedBackers.has(backer.id)}
                      id={`backer-${backer.id}`}
                    >
                      <Box paddingInlineStart="800" paddingBlockStart="300">
                        <Divider />
                        <Box paddingBlockStart="300">
                          <BlockStack gap="200">
                            {backer.reward && (
                              <BlockStack gap="100">
                                <Text variant="bodySm" fontWeight="medium">Reward:</Text>
                                <Text variant="bodySm">
                                  {backer.reward.name}
                                  {backer.reward.quantity && ` (Qty: ${backer.reward.quantity})`}
                                  {backer.reward.sku && ` - SKU: ${backer.reward.sku}`}
                                </Text>
                              </BlockStack>
                            )}
                            
                            {backer.addOns && backer.addOns.length > 0 && (
                              <BlockStack gap="100">
                                <Text variant="bodySm" fontWeight="medium">Add-ons:</Text>
                                <BlockStack gap="050">
                                  {backer.addOns.map((addon, idx) => (
                                    <Text key={idx} variant="bodySm">
                                      • {addon.name}
                                      {addon.quantity && ` (Qty: ${addon.quantity})`}
                                      {addon.sku && ` - SKU: ${addon.sku}`}
                                    </Text>
                                  ))}
                                </BlockStack>
                              </BlockStack>
                            )}
                            
                            {(backer.shippingCity || backer.shippingCountry) && (
                              <BlockStack gap="100">
                                <Text variant="bodySm" fontWeight="medium">Shipping:</Text>
                                <Text variant="bodySm">
                                  {[backer.shippingCity, backer.shippingCountry].filter(Boolean).join(', ')}
                                </Text>
                              </BlockStack>
                            )}
                            
                            {backer.notes && (
                              <BlockStack gap="100">
                                <Text variant="bodySm" fontWeight="medium">Notes:</Text>
                                <Text variant="bodySm">{backer.notes}</Text>
                              </BlockStack>
                            )}
                          </BlockStack>
                        </Box>
                      </Box>
                    </Collapsible>
                  </Box>
                  {filteredBackers.indexOf(backer) < filteredBackers.length - 1 && <Divider />}
                </div>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default BackerPreview;