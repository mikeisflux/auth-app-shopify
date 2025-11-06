// MarkAsPaid.js - Mark open draft orders as paid
// Location: /frontend/src/components/MarkAsPaid.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Checkbox,
  TextField,
  Filters,
  ChoiceList,
  Collapsible
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@shopify/polaris-icons';

function MarkAsPaid() {
  const navigate = useNavigate();
  const [draftOrders, setDraftOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState(null);

  // Filter states
  const [searchValue, setSearchValue] = useState('');
  const [sortValue, setSortValue] = useState('date-desc');
  const [priceRange, setPriceRange] = useState('all');

  useEffect(() => {
    fetchDraftOrders();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [draftOrders, searchValue, sortValue, priceRange]);

  const fetchDraftOrders = async () => {
    try {
      setLoading(true);
      console.log('Fetching open draft orders...');
      const response = await fetch('/api/draft-orders/open');

      if (!response.ok) {
        throw new Error('Failed to fetch draft orders');
      }

      const data = await response.json();
      console.log(`Loaded ${data.count} open draft orders`);
      setDraftOrders(data.draftOrders || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching draft orders:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...draftOrders];

    // Apply search filter
    if (searchValue) {
      const search = searchValue.toLowerCase();
      filtered = filtered.filter(order =>
        order.customerName?.toLowerCase().includes(search) ||
        order.email?.toLowerCase().includes(search) ||
        order.name?.toLowerCase().includes(search) ||
        order.lineItems.some(item =>
          item.title?.toLowerCase().includes(search) ||
          item.sku?.toLowerCase().includes(search)
        )
      );
    }

    // Apply price range filter
    if (priceRange !== 'all') {
      filtered = filtered.filter(order => {
        const price = parseFloat(order.totalPrice);
        switch (priceRange) {
          case 'under-50':
            return price < 50;
          case '50-100':
            return price >= 50 && price < 100;
          case '100-200':
            return price >= 100 && price < 200;
          case 'over-200':
            return price >= 200;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortValue) {
        case 'date-desc':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'date-asc':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'customer-asc':
          return (a.customerName || '').localeCompare(b.customerName || '');
        case 'customer-desc':
          return (b.customerName || '').localeCompare(a.customerName || '');
        case 'price-asc':
          return parseFloat(a.totalPrice) - parseFloat(b.totalPrice);
        case 'price-desc':
          return parseFloat(b.totalPrice) - parseFloat(a.totalPrice);
        case 'items-asc':
          return a.totalItems - b.totalItems;
        case 'items-desc':
          return b.totalItems - a.totalItems;
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  };

  const handleToggleSelect = (orderId) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const handleToggleExpand = (orderId) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev);
      const wasExpanded = newSet.has(orderId);

      if (wasExpanded) {
        newSet.delete(orderId);
        console.log(`Collapsed order ${orderId}`);
      } else {
        newSet.add(orderId);
        console.log(`Expanded order ${orderId}`);
        // Scroll to the expanded section after a brief delay
        setTimeout(() => {
          const element = document.getElementById(`expanded-${orderId}`);
          if (element) {
            console.log(`Scrolling to expanded section for order ${orderId}`);
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } else {
            console.error(`Could not find expanded element for order ${orderId}`);
          }
        }, 100);
      }
      return newSet;
    });
  };

  const handleMarkAsPaid = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one draft order to mark as paid');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to mark ${selectedOrders.size} draft order(s) as paid?\n\n` +
      `This will create regular paid orders in Shopify.`
    );

    if (!confirmed) return;

    console.log('Marking', selectedOrders.size, 'draft orders as paid');
    setMarking(true);

    try {
      const response = await fetch('/api/draft-orders/mark-as-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftOrderIds: Array.from(selectedOrders)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark orders as paid');
      }

      console.log('Mark as paid results:', data.results);

      // Show results
      const successCount = data.results.success.length;
      const failedCount = data.results.failed.length;

      let message = `Mark as Paid Complete!\n\n`;
      message += `✓ Successful: ${successCount}\n`;
      message += `✗ Failed: ${failedCount}\n\n`;

      if (successCount > 0) {
        message += `Successfully created ${successCount} paid order(s)!\n`;
      }

      if (failedCount > 0) {
        message += `\nFailed orders:\n`;
        data.results.failed.forEach(fail => {
          message += `- Draft Order #${fail.draftOrderId}: ${fail.error}\n`;
        });
      }

      alert(message);

      // Refresh draft orders to show updated list
      await fetchDraftOrders();

      // Clear selections
      setSelectedOrders(new Set());

    } catch (error) {
      console.error('Mark as paid error:', error);
      alert(`Failed to mark orders as paid: ${error.message}`);
    } finally {
      setMarking(false);
    }
  };

  const handleClearFilters = () => {
    setSearchValue('');
    setSortValue('date-desc');
    setPriceRange('all');
  };

  const filters = [
    {
      key: 'priceRange',
      label: 'Price Range',
      filter: (
        <ChoiceList
          title="Price Range"
          titleHidden
          choices={[
            { label: 'All Prices', value: 'all' },
            { label: 'Under $50', value: 'under-50' },
            { label: '$50 - $100', value: '50-100' },
            { label: '$100 - $200', value: '100-200' },
            { label: 'Over $200', value: 'over-200' },
          ]}
          selected={[priceRange]}
          onChange={(value) => setPriceRange(value[0])}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (priceRange !== 'all') {
    const priceLabel = {
      'under-50': 'Under $50',
      '50-100': '$50 - $100',
      '100-200': '$100 - $200',
      'over-200': 'Over $200'
    }[priceRange];
    appliedFilters.push({
      key: 'priceRange',
      label: `Price: ${priceLabel}`,
      onRemove: () => setPriceRange('all'),
    });
  }

  // Create table rows (simple, no expansion in table)
  const tableRows = filteredOrders.map((order) => {
    const isExpanded = expandedOrders.has(order.id);
    return [
      <Checkbox
        key={`checkbox-${order.id}`}
        checked={selectedOrders.has(order.id)}
        onChange={() => handleToggleSelect(order.id)}
      />,
      <Button
        key={`expand-${order.id}`}
        icon={isExpanded ? ChevronUpIcon : ChevronDownIcon}
        onClick={() => handleToggleExpand(order.id)}
        plain
      />,
      order.name || 'N/A',
      order.customerName || 'No Name',
      order.email || 'N/A',
      order.totalItems || 0,
      `${order.currency || '$'}${parseFloat(order.totalPrice || 0).toFixed(2)}`,
      new Date(order.createdAt).toLocaleDateString()
    ];
  });

  const primaryAction = {
    content: marking ? 'Marking as Paid...' : `Mark as Paid (${selectedOrders.size})`,
    onAction: handleMarkAsPaid,
    disabled: selectedOrders.size === 0 || marking,
    loading: marking,
    icon: CheckCircleIcon
  };

  const secondaryActions = [
    {
      content: 'Refresh',
      onAction: fetchDraftOrders,
    },
    {
      content: 'Dashboard',
      icon: ArrowLeftIcon,
      onAction: () => navigate('/dashboard'),
    },
  ];

  if (loading) {
    return (
      <div className="markaspaid-container">
        <div className="markaspaid-max-width">
          <div className="markaspaid-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Spinner size="large" />
            <Box paddingBlockStart="400">
              <Text variant="headingMd">Loading draft orders...</Text>
            </Box>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="markaspaid-container">
        <div className="markaspaid-max-width">
          <div className="markaspaid-header">
            <h1 className="markaspaid-title">Mark as Paid</h1>
          </div>
          <div className="markaspaid-actions">
            {secondaryActions.map((action, index) => (
              <button key={index} onClick={action.onAction} className="markaspaid-btn-secondary">
                {action.content}
              </button>
            ))}
          </div>
          <Banner status="critical">
            <Text as="p">Error loading draft orders: {error}</Text>
          </Banner>
        </div>
      </div>
    );
  }

  return (
    <div className="markaspaid-container">
      <div className="markaspaid-max-width">
        {/* Header */}
        <div className="markaspaid-header">
          <h1 className="markaspaid-title">Mark Draft Orders as Paid</h1>
          <p className="markaspaid-subtitle">{filteredOrders.length} open draft order(s) found</p>
        </div>

        {/* Action Buttons */}
        <div className="markaspaid-actions">
          <button
            onClick={handleMarkAsPaid}
            disabled={selectedOrders.size === 0 || marking}
            className="markaspaid-btn-primary"
          >
            {marking ? (
              <>
                <Spinner size="small" />
                <span>Marking as Paid...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon />
                <span>Mark as Paid ({selectedOrders.size})</span>
              </>
            )}
          </button>
          {secondaryActions.map((action, index) => (
            <button key={index} onClick={action.onAction} className="markaspaid-btn-secondary">
              {action.content}
            </button>
          ))}
        </div>
        {/* Summary Stats */}
        <div className="markaspaid-stats-grid">
          <div className="markaspaid-stat-card">
            <div className="markaspaid-stat-value">{draftOrders.length}</div>
            <div className="markaspaid-stat-label">Total Open Orders</div>
          </div>
          <div className="markaspaid-stat-card">
            <div className="markaspaid-stat-value">{filteredOrders.length}</div>
            <div className="markaspaid-stat-label">Filtered Orders</div>
          </div>
          <div className="markaspaid-stat-card">
            <div className="markaspaid-stat-value">{selectedOrders.size}</div>
            <div className="markaspaid-stat-label">Selected</div>
          </div>
          <div className="markaspaid-stat-card">
            <div className="markaspaid-stat-value">
              ${draftOrders.reduce((sum, o) => sum + parseFloat(o.totalPrice || 0), 0).toFixed(2)}
            </div>
            <div className="markaspaid-stat-label">Total Value</div>
          </div>
        </div>

        {/* Selection Info */}
        {selectedOrders.size > 0 && (
          <div className="alert-info" style={{ marginBottom: '1.5rem' }}>
            <div className="alert-info-content">
              <span className="alert-info-text">
                {selectedOrders.size} order{selectedOrders.size !== 1 ? 's' : ''} selected
              </span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="markaspaid-card">
          <Filters
            queryValue={searchValue}
            queryPlaceholder="Search by customer name, email, or items..."
            filters={filters}
            appliedFilters={appliedFilters}
            onQueryChange={setSearchValue}
            onQueryClear={() => setSearchValue('')}
            onClearAll={handleClearFilters}
          >
            <div style={{ paddingLeft: '8px' }}>
              <ChoiceList
                title="Sort by"
                choices={[
                  { label: 'Date (Newest First)', value: 'date-desc' },
                  { label: 'Date (Oldest First)', value: 'date-asc' },
                  { label: 'Customer Name (A-Z)', value: 'customer-asc' },
                  { label: 'Customer Name (Z-A)', value: 'customer-desc' },
                  { label: 'Price (Low to High)', value: 'price-asc' },
                  { label: 'Price (High to Low)', value: 'price-desc' },
                  { label: 'Items (Few to Many)', value: 'items-asc' },
                  { label: 'Items (Many to Few)', value: 'items-desc' },
                ]}
                selected={[sortValue]}
                onChange={(value) => setSortValue(value[0])}
              />
            </div>
          </Filters>
        </div>

        {/* Draft Orders Table */}
        <div className="markaspaid-card">
          <DataTable
            columnContentTypes={[
              'text',
              'text',
              'text',
              'text',
              'text',
              'numeric',
              'numeric',
              'text'
            ]}
            headings={[
              <Checkbox
                key="select-all"
                checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                onChange={handleSelectAll}
                label="Select All"
                labelHidden
              />,
              '',
              'Order #',
              'Customer',
              'Email',
              'Items',
              'Total',
              'Date'
            ]}
            rows={tableRows}
            hasZebraStriping
          />
        </div>

        {/* Expanded Order Details */}
        {expandedOrders.size > 0 && (
          <div style={{
            marginTop: '2rem',
            marginBottom: '1rem',
            padding: '1rem',
            background: 'rgba(5, 150, 105, 0.1)',
            borderRadius: '0.75rem',
            borderLeft: '4px solid #10B981'
          }}>
            <Text variant="headingMd" as="h2">
              📋 Expanded Order Details ({expandedOrders.size})
            </Text>
            <Text variant="bodySm" tone="subdued">
              Click the collapse button or chevron icon to hide details
            </Text>
          </div>
        )}
        {filteredOrders.map(order => {
          const isExpanded = expandedOrders.has(order.id);
          if (!isExpanded) return null;

          console.log(`Rendering expanded details for order ${order.id}:`, order);

          return (
            <div key={`expanded-${order.id}`} id={`expanded-${order.id}`} className="markaspaid-expanded-details" style={{
              marginBottom: '1rem',
              animation: 'fadeIn 0.3s ease-in'
            }}>
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingLg">Order Details: {order.name}</Text>
                <Button
                  icon={ChevronUpIcon}
                  onClick={() => handleToggleExpand(order.id)}
                  plain
                >
                  Collapse
                </Button>
              </InlineStack>

              <Box paddingBlockStart="400">
                <Text variant="headingMd" as="h3">Order Items</Text>
                <Box paddingBlockStart="300">
                  <BlockStack gap="300">
                    {(order.lineItems || []).map((item, idx) => (
                      <div key={`item-${order.id}-${idx}`} className="markaspaid-item-card">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="bodyMd" fontWeight="semibold">
                            {item.name || item.title}
                          </Text>
                          <Text variant="bodyMd">
                            {item.quantity} × ${parseFloat(item.price).toFixed(2)}
                          </Text>
                        </InlineStack>
                        {item.sku && (
                          <Box paddingBlockStart="100">
                            <Text variant="bodySm" tone="subdued">
                              SKU: {item.sku}
                            </Text>
                          </Box>
                        )}
                        {item.variantTitle && (
                          <Box paddingBlockStart="100">
                            <Text variant="bodySm" tone="subdued">
                              Variant: {item.variantTitle}
                            </Text>
                          </Box>
                        )}
                      </div>
                    ))}
                  </BlockStack>
                </Box>
              </Box>

              {order.note && (
                <Box paddingBlockStart="400">
                  <Text variant="bodyMd" fontWeight="semibold">Notes:</Text>
                  <Box paddingBlockStart="200">
                    <Text variant="bodySm" tone="subdued">{order.note}</Text>
                  </Box>
                </Box>
              )}

              {order.shippingAddress && (
                <Box paddingBlockStart="400">
                  <Text variant="bodyMd" fontWeight="semibold">Shipping Address:</Text>
                  <Box paddingBlockStart="200">
                    <Text variant="bodySm" tone="subdued">
                      {order.shippingAddress.address1}
                      {order.shippingAddress.address2 && `, ${order.shippingAddress.address2}`}
                      <br />
                      {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}
                      <br />
                      {order.shippingAddress.country}
                    </Text>
                  </Box>
                </Box>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MarkAsPaid;
