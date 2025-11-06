// ProgressBar.js - Converted to use Polaris components
// Location: /ProgressBar.js

import React from 'react';
import {
  ProgressBar,
  InlineStack,
  Text
} from '@shopify/polaris';

export default function ModernProgressBar({ progress = 0, label = 'Loading...', size = 'medium' }) {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  
  // Map size to Polaris ProgressBar size
  const polarisSize = size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium';

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ marginBottom: 'var(--p-space-200)' }}>
          <InlineStack align="space-between">
            <Text variant="bodyMd" fontWeight="medium">{label}</Text>
            <Text variant="bodyMd" fontWeight="bold">{clampedProgress}%</Text>
          </InlineStack>
        </div>
      )}
      
      <ProgressBar 
        progress={clampedProgress} 
        size={polarisSize}
        tone="primary"
      />
    </div>
  );
}