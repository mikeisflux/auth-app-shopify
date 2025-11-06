// App.js - Updated with Multi-User Fulfillment Routes - PRESERVES ALL EXISTING FUNCTIONALITY
// Location: /frontend/src/App.js

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

// EXISTING IMPORTS - DO NOT REMOVE
import Dashboard from './components/Dashboard';
import CsvUpload from './components/CsvUpload';
import ProductMapping from './components/ProductMapping';
import ImportPreview from './components/ImportPreview';
import ImportReport from './components/ImportReport';
import Export from './components/Export';
import CustomerMergePage from './components/CustomerMergePage';
import BackerPreview from './components/BackerPreview';

// NEW FULFILLMENT IMPORTS
import FulfillmentDashboard from './components/FulfillmentDashboard';
import AdminDashboard from './components/AdminDashboard';
import EmployeeStation from './components/EmployeeStation';
import PullList from './components/PullList';
import OrderScanningPage from './components/OrderScanningPage';

// MARK AS PAID IMPORT
import MarkAsPaid from './components/MarkAsPaid';

function App() {
  return (
    <AppProvider 
      i18n={{
        Polaris: {
          Avatar: {
            label: 'Avatar',
            labelWithInitials: 'Avatar with initials {initials}',
          },
          ContextualSaveBar: {
            save: 'Save',
            discard: 'Discard',
          },
          TextField: {
            characterCount: '{count} characters',
          },
          TopBar: {
            toggleMenuLabel: 'Toggle menu',
            SearchField: {
              clearButtonLabel: 'Clear',
              search: 'Search',
            },
          },
          Modal: {
            iFrameTitle: 'body markup',
          },
          Frame: {
            skipToContent: 'Skip to content',
            navigationLabel: 'Navigation',
            Navigation: {
              closeMobileNavigationLabel: 'Close navigation',
            },
          },
        },
      }}
    >
      <Router>
        <Routes>
          {/* EXISTING ROUTES - DO NOT MODIFY */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customer-merge" element={<CustomerMergePage />} />
          <Route path="/project/:projectId/upload" element={<CsvUpload />} />
          <Route path="/project/:projectId/mapping" element={<ProductMapping />} />
          <Route path="/project/:projectId/preview" element={<ImportPreview />} />
          <Route path="/project/:projectId/backers" element={<BackerPreview />} />
          <Route path="/project/:projectId/export" element={<Export />} />
          <Route path="/project/:projectId/report" element={<ImportReport />} />

          {/* MARK AS PAID ROUTE */}
          <Route path="/mark-as-paid" element={<MarkAsPaid />} />

          {/* NEW FULFILLMENT ROUTES - ADDED WITHOUT AFFECTING EXISTING */}
          <Route path="/fulfillment" element={<FulfillmentDashboard />} />
          <Route path="/fulfillment/admin" element={<AdminDashboard />} />
          <Route path="/employee/:userId" element={<EmployeeStation />} />
          <Route path="/employee/:userId/pull-list/:assignmentId" element={<PullList />} />
          <Route path="/employee/:userId/scan/:assignmentId" element={<OrderScanningPage />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;