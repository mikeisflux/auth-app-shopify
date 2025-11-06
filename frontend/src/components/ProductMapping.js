// ProductMapping.js - Futuristic Styled Version
// Location: /frontend/src/components/ProductMapping.js

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, CheckCircle, AlertCircle, RefreshCw, ChevronDown, ArrowLeft, Loader } from 'lucide-react';

function ProductMapping() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [mappings, setMappings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState({});
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchProducts();
  }, [projectId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/project/${projectId}/mappings`);
      if (!response.ok) throw new Error('Failed to fetch products');
      
      const data = await response.json();
      console.log('Fetched products:', data);
      setProducts(data);
      
      const initialMappings = {};
      data.forEach(product => {
        initialMappings[product.name] = {
          skus: [product.sku || ''],
          errors: [null]
        };
      });
      console.log('Initial mappings:', initialMappings);
      setMappings(initialMappings);
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleClearAllMappings = async () => {
    if (!window.confirm('This will delete ALL saved mappings for this project. Are you sure?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/project/${projectId}/clear-mappings`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to clear mappings');
      
      await fetchProducts();
      alert('All mappings cleared from database');
    } catch (err) {
      console.error('Error clearing mappings:', err);
      alert('Failed to clear mappings');
    }
  };

  const handleSkuChange = (productName, index, value) => {
    setMappings(prev => ({
      ...prev,
      [productName]: {
        ...prev[productName],
        skus: prev[productName].skus.map((sku, i) => i === index ? value : sku)
      }
    }));
  };

  const handleAddSku = (productName) => {
    setMappings(prev => ({
      ...prev,
      [productName]: {
        skus: [...(prev[productName]?.skus || ['']), ''],
        errors: [...(prev[productName]?.errors || [null]), null]
      }
    }));
  };

  const handleRemoveSku = (productName, index) => {
    setMappings(prev => ({
      ...prev,
      [productName]: {
        skus: (prev[productName]?.skus || []).filter((_, i) => i !== index),
        errors: (prev[productName]?.errors || []).filter((_, i) => i !== index)
      }
    }));
  };

  const validateSku = async (productName, index, sku) => {
    if (!sku.trim()) return;

    setValidating(prev => ({ ...prev, [`${productName}-${index}`]: true }));

    try {
      const response = await fetch(`/api/project/${projectId}/validate-skus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skus: [sku] })
      });

      const data = await response.json();
      
      setMappings(prev => ({
        ...prev,
        [productName]: {
          ...prev[productName],
          errors: (prev[productName]?.errors || []).map((err, i) => 
            i === index ? (data.results[sku]?.valid ? null : 'Invalid SKU') : err
          )
        }
      }));
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(prev => ({ ...prev, [`${productName}-${index}`]: false }));
    }
  };

  const handleSave = async () => {
    const hasEmptySkus = Object.entries(mappings).some(([_, mapping]) =>
      mapping?.skus?.some(sku => !sku.trim())
    );

    if (hasEmptySkus) {
      alert('Please fill in all SKU fields or remove empty ones');
      return;
    }

    const hasErrors = Object.entries(mappings).some(([_, mapping]) =>
      mapping?.errors?.some(err => err !== null)
    );

    if (hasErrors) {
      alert('Please fix all SKU validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      const mappingsArray = Object.entries(mappings)
        .filter(([_, mapping]) => mapping?.skus?.length > 0)
        .map(([name, mapping]) => ({
          kickstarterName: name,
          skus: mapping.skus.filter(sku => sku.trim())
        }));

      const response = await fetch(`/api/project/${projectId}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: mappingsArray })
      });

      if (!response.ok) throw new Error('Failed to save mappings');

      navigate(`/project/${projectId}/preview`);
    } catch (err) {
      console.error('Error saving mappings:', err);
      alert(`Failed to save mappings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mapping-container">
        <div className="dashboard-max-width">
          <div style={{ textAlign: 'center', padding: '4rem 0' }}>
            <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto 1rem' }}></div>
            <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mapping-container">
      <div className="dashboard-max-width">
        {/* Header */}
        <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
          <div>
            <h1 className="dashboard-title" style={{ background: 'linear-gradient(to right, #F59E0B, #D97706)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Map Products to SKUs
            </h1>
            <p className="dashboard-subtitle">Map each Kickstarter product to one or more Shopify SKUs</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={scrollToBottom}
              className="btn-white"
            >
              <ChevronDown size={18} />
              <span>Skip to Bottom</span>
            </button>
            <button
              onClick={handleClearAllMappings}
              className="btn-white"
              style={{ color: '#DC2626' }}
            >
              <Trash2 size={18} />
              <span>Clear All Mappings</span>
            </button>
            <button
              onClick={() => navigate(`/project/${projectId}/upload`)}
              className="btn-white"
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="alert-error" style={{ marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        {/* Product Mappings */}
        <div style={{ marginBottom: '2rem' }}>
          {products.map(product => {
            const productMapping = mappings[product.name] || { skus: [''], errors: [null] };
            
            return (
              <div key={product.name} className="mapping-card">
                <div className="mapping-product-header">
                  <div>
                    <h3 className="mapping-product-name">{product.name}</h3>
                    {product.sku && (
                      <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                        Original: {product.sku}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setMappings(prev => ({
                        ...prev,
                        [product.name]: {
                          skus: [''],
                          errors: [null]
                        }
                      }));
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#FEF3C7', color: '#92400E', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                  >
                    <RefreshCw size={16} />
                    <span>Clear</span>
                  </button>
                </div>
                
                <div>
                  {productMapping.skus.map((sku, index) => (
                    <div key={index} className="mapping-sku-row">
                      <div className={`mapping-sku-input ${productMapping.errors[index] ? 'error' : sku && !productMapping.errors[index] ? 'success' : ''}`}>
                        <input
                          type="text"
                          value={sku || ''}
                          onChange={(e) => handleSkuChange(product.name, index, e.target.value)}
                          onBlur={() => validateSku(product.name, index, sku)}
                          placeholder="Enter Shopify SKU"
                        />
                        {productMapping.errors[index] && (
                          <p style={{ color: '#EF4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {productMapping.errors[index]}
                          </p>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {validating[`${product.name}-${index}`] && (
                          <Loader size={20} className="loading-spinner" />
                        )}
                        {!validating[`${product.name}-${index}`] && sku && !productMapping.errors[index] && (
                          <CheckCircle size={20} style={{ color: '#10B981' }} />
                        )}
                        {!validating[`${product.name}-${index}`] && sku && productMapping.errors[index] && (
                          <AlertCircle size={20} style={{ color: '#EF4444' }} />
                        )}
                      </div>

                      {productMapping.skus.length > 1 && (
                        <button
                          onClick={() => handleRemoveSku(product.name, index)}
                          style={{ padding: '0.75rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => handleAddSku(product.name)}
                    className="mapping-add-btn"
                  >
                    <Plus size={18} />
                    <span>Add Another SKU</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div ref={bottomRef} className="mapping-bottom-actions">
          <button
            onClick={() => navigate(`/project/${projectId}/upload`)}
            className="btn-white"
            style={{ flex: 1 }}
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gradient-primary"
            style={{ flex: 2, opacity: saving ? 0.5 : 1 }}
          >
            {saving ? (
              <>
                <div className="loading-spinner"></div>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Mappings & Continue</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProductMapping;