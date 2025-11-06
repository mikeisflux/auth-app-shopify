// CustomerMergePage.js - NO ICONS VERSION (Polaris v11 compatible)
// Location: /CustomerMergePage.js

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  Button,
  Banner,
  Text,
  InlineStack,
  BlockStack,
  Spinner,
  Badge,
  Modal,
  Checkbox,
  DataTable,
  Box
} from '@shopify/polaris';

function CustomerMergePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [mergePreview, setMergePreview] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [success, setSuccess] = useState(null);

  // Fetch unfulfilled Shopify orders and analyze duplicates
  const fetchOrderData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching unfulfilled Shopify orders and analyzing duplicates...');
      
      const response = await fetch('/api/import/consolidation/customers-multiple-orders');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch customer data');
      }
      
      const data = await response.json();
      
      setAnalysis(data);
      setDuplicateCustomers(data.customersWithMultipleOrders || []);
      
      console.log(`Found ${data.customersWithMultipleOrders.length} customers with multiple unfulfilled orders`);
      
    } catch (err) {
      console.error('Error fetching order data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate merge preview
  const generateMergePreview = useCallback(async (customer) => {
    try {
      console.log(`Generating merge preview for ${customer.email}`);
      
      const orderIds = customer.orders.map(order => order.id);
      
      const response = await fetch('/api/import/consolidation/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: customer.email,
          orderIds: orderIds
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }
      
      const data = await response.json();
      setMergePreview(data.preview);
      
    } catch (err) {
      console.error('Error generating merge preview:', err);
      setError(err.message);
    }
  }, []);

  // Perform actual merge
  const performMerge = useCallback(async () => {
    if (!selectedCustomer || selectedOrders.length === 0) return;
    
    setMerging(true);
    setError(null);
    
    try {
      console.log(`Consolidating orders for ${selectedCustomer.email}`);
      
      const response = await fetch('/api/import/consolidation/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: selectedCustomer.email,
          orderIds: selectedOrders
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to consolidate orders');
      }
      
      const data = await response.json();
      
      console.log('Consolidation completed:', data.result);
      
      setSuccess(`Successfully consolidated ${data.result.originalOrders.count} orders into new paid order ${data.result.consolidatedOrder.name} (${data.result.consolidatedOrder.currency} ${data.result.consolidatedOrder.total_price})`);
      
      // Close modal and refresh data
      setShowMergeModal(false);
      setSelectedCustomer(null);
      setMergePreview(null);
      setSelectedOrders([]);
      
      // Refresh the customer data
      await fetchOrderData();
      
    } catch (err) {
      console.error('Error consolidating orders:', err);
      setError(err.message);
    } finally {
      setMerging(false);
    }
  }, [selectedCustomer, selectedOrders, fetchOrderData]);

  // Handle customer selection for merging
  const handleCustomerSelect = useCallback(async (customer) => {
    setSelectedCustomer(customer);
    setSelectedOrders(customer.orders.map(order => order.id)); // Select all orders by default
    await generateMergePreview(customer);
    setShowMergeModal(true);
  }, [generateMergePreview]);

  // Handle order selection toggle
  const handleOrderToggle = useCallback((orderId) => {
    setSelectedOrders(prev => {
      const newSelection = prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId];
      
      // Regenerate preview with new selection
      if (selectedCustomer && newSelection.length > 0) {
        setTimeout(() => {
          generateMergePreview({
            ...selectedCustomer,
            orders: selectedCustomer.orders.filter(order => newSelection.includes(order.id))
          });
        }, 100);
      }
      
      return newSelection;
    });
  }, [selectedCustomer, generateMergePreview]);

  // Load data on component mount
  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  const primaryAction = {
    content: 'Refresh Data',
    onAction: fetchOrderData,
    disabled: loading,
    loading: loading
  };

  const secondaryActions = [
    {
      content: 'Back to Projects',
      onAction: () => navigate('/'),
    },
  ];

  // Create data table rows for customers
  const customerRows = duplicateCustomers.map((customer, index) => [
    customer.email,
    customer.customer ? `${customer.customer.first_name} ${customer.customer.last_name}` : '-',
    customer.orderCount.toString(),
    `$${customer.totalValue.toFixed(2)}`,
    `$${customer.totalShipping.toFixed(2)}`,
    `$${customer.totalTax.toFixed(2)}`,
    customer.orders.map(o => o.name).join(', '),
    <Button
      key={index}
      variant="primary"
      onClick={() => handleCustomerSelect(customer)}
      disabled={loading || merging}
    >
      Consolidate Orders
    </Button>
  ]);

  return (
    <Page
      title="Order Consolidation"
      subtitle="Consolidate multiple unfulfilled orders from the same customer into single paid orders"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Layout>
        <Layout.Section>
          <Banner status="info">
            <Text variant="bodyMd">
              This tool consolidates multiple unfulfilled orders from the same customer into single paid orders with all original amounts (subtotal, shipping, tax) preserved. Original orders are marked as fulfilled and reference the new consolidated order.
            </Text>
          </Banner>
        </Layout.Section>

        {error && (
          <Layout.Section>
            <Banner status="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          </Layout.Section>
        )}

        {success && (
          <Layout.Section>
            <Banner status="success" onDismiss={() => setSuccess(null)}>
              <p>{success}</p>
            </Banner>
          </Layout.Section>
        )}

        {analysis && (
          <Layout.Section>
            <Layout>
              <Layout.Section oneQuarter>
                <Card sectioned>
                  <BlockStack gap="200">
                    <Text variant="headingSm">Total Customers</Text>
                    <Text variant="headingMd">{analysis.totalCustomers}</Text>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section oneQuarter>
                <Card sectioned>
                  <BlockStack gap="200">
                    <Text variant="headingSm">With Multiple Orders</Text>
                    <Text variant="headingMd">{analysis.customersWithMultipleOrders.length}</Text>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section oneQuarter>
                <Card sectioned>
                  <BlockStack gap="200">
                    <Text variant="headingSm">Potential Consolidations</Text>
                    <Text variant="headingMd">
                      {analysis.customersWithMultipleOrders.reduce((sum, c) => sum + (c.orderCount - 1), 0)}
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>

              <Layout.Section oneQuarter>
                <Card sectioned>
                  <BlockStack gap="200">
                    <Text variant="headingSm">Total Value</Text>
                    <Text variant="headingMd">
                      ${analysis.customersWithMultipleOrders.reduce((sum, c) => sum + c.totalValue, 0).toFixed(2)}
                    </Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            </Layout>
          </Layout.Section>
        )}

        {loading && (
          <Layout.Section>
            <Card sectioned>
              <Box padding="800">
                <InlineStack gap="300" align="center">
                  <Spinner size="large" />
                  <Text variant="headingMd">Analyzing customer orders...</Text>
                </InlineStack>
              </Box>
            </Card>
          </Layout.Section>
        )}

        {!loading && duplicateCustomers.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg">Customers with Multiple Orders</Text>
                <DataTable
                  columnContentTypes={[
                    'text',
                    'text', 
                    'numeric',
                    'numeric',
                    'numeric',
                    'numeric',
                    'text',
                    'text'
                  ]}
                  headings={[
                    'Email',
                    'Customer Name', 
                    'Orders',
                    'Total Value',
                    'Shipping',
                    'Tax',
                    'Order Numbers',
                    'Action'
                  ]}
                  rows={customerRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {!loading && duplicateCustomers.length === 0 && analysis && (
          <Layout.Section>
            <Card sectioned>
              <Box padding="800">
                <BlockStack gap="400" align="center">
                  <div style={{ fontSize: '4rem' }}>✅</div>
                  <Text variant="headingLg">No Orders to Consolidate</Text>
                  <Text variant="bodyMd" tone="subdued">
                    All customers have only one order each. No consolidation is necessary.
                  </Text>
                </BlockStack>
              </Box>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      {/* Consolidation Modal */}
      <Modal
        open={showMergeModal}
        onClose={() => {
          setShowMergeModal(false);
          setSelectedCustomer(null);
          setMergePreview(null);
          setSelectedOrders([]);
        }}
        title={selectedCustomer ? `Consolidate Orders for ${selectedCustomer.email}` : 'Consolidate Orders'}
        primaryAction={{
          content: merging ? 'Consolidating...' : 'Confirm Consolidation',
          onAction: performMerge,
          disabled: merging || selectedOrders.length < 2,
          loading: merging
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => {
              setShowMergeModal(false);
              setSelectedCustomer(null);
              setMergePreview(null);
              setSelectedOrders([]);
            }
          }
        ]}
        large
      >
        <Modal.Section>
          <BlockStack gap="400">
            {mergePreview && (
              <Card sectioned>
                <BlockStack gap="300">
                  <Text variant="headingMd">Consolidation Preview</Text>
                  <Layout>
                    <Layout.Section oneQuarter>
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">Orders to Consolidate</Text>
                        <Text variant="headingMd">{mergePreview.totalOrders}</Text>
                      </BlockStack>
                    </Layout.Section>
                    <Layout.Section oneQuarter>
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">Total Value</Text>
                        <Text variant="headingMd">${mergePreview.totalValue.toFixed(2)}</Text>
                      </BlockStack>
                    </Layout.Section>
                    <Layout.Section oneQuarter>
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">Total Shipping</Text>
                        <Text variant="headingMd">${mergePreview.totalShipping.toFixed(2)}</Text>
                      </BlockStack>
                    </Layout.Section>
                    <Layout.Section oneQuarter>
                      <BlockStack gap="100">
                        <Text variant="bodySm" tone="subdued">Total Tax</Text>
                        <Text variant="headingMd">${mergePreview.totalTax.toFixed(2)}</Text>
                      </BlockStack>
                    </Layout.Section>
                  </Layout>
                  <Text variant="bodySm" tone="subdued">
                    Order Numbers: {mergePreview.originalOrderNumbers.join(', ')}
                  </Text>
                  
                  {mergePreview.warnings && mergePreview.warnings.length > 0 && (
                    <Banner status="warning">
                      <BlockStack gap="200">
                        <Text variant="bodyMd" fontWeight="medium">Warnings:</Text>
                        {mergePreview.warnings.map((warning, idx) => (
                          <Text key={idx} variant="bodySm">{warning.message}</Text>
                        ))}
                      </BlockStack>
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            )}

            <Card sectioned>
              <BlockStack gap="300">
                <Text variant="headingMd">Select Orders to Consolidate (minimum 2 required)</Text>
                <BlockStack gap="200">
                  {selectedCustomer?.orders.map(order => (
                    <InlineStack key={order.id} gap="300" align="space-between">
                      <InlineStack gap="200" align="start">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => handleOrderToggle(order.id)}
                        />
                        <Text variant="bodyMd" fontWeight="medium">{order.name}</Text>
                      </InlineStack>
                      <InlineStack gap="200" align="end">
                        <Text variant="bodySm">${parseFloat(order.total_price || 0).toFixed(2)}</Text>
                        <Text variant="bodySm">{new Date(order.created_at).toLocaleDateString()}</Text>
                        <Badge status={order.financial_status === 'paid' ? 'success' : 'attention'}>
                          {order.financial_status}
                        </Badge>
                        <Badge status="warning">
                          {order.fulfillment_status || 'unfulfilled'}
                        </Badge>
                      </InlineStack>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

            <Banner status="warning">
              <Text variant="bodyMd">
                <Text variant="bodyMd" fontWeight="bold">Order Consolidation:</Text> This will create a new PAID order combining all selected orders with preserved subtotal, shipping, and tax amounts. 
                Original orders will be marked as fulfilled and reference the new consolidated order. The new order will be ready for fulfillment and shipping.
              </Text>
            </Banner>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export default CustomerMergePage;