// Global navigation helper - preserves shop and host params
function navigate(path) {
  // Get current shop and host from URL
  const urlParams = new URLSearchParams(window.location.search);
  const shop = urlParams.get('shop');
  const host = urlParams.get('host');

  // Add shop and host to the path if they exist
  if (shop) {
    const separator = path.includes('?') ? '&' : '?';
    path += `${separator}shop=${encodeURIComponent(shop)}`;
    if (host) {
      path += `&host=${encodeURIComponent(host)}`;
    }
  }

  console.log('Navigating to:', path);

  // For Shopify embedded apps, use window.location.href for relative paths
  // Shopify automatically handles the iframe routing
  window.location.href = path;
}

// Show toast message
function showToast(message, isError = false) {
  if (window.shopifyToast) {
    window.shopifyToast(message, isError);
  } else if (window.shopify && window.shopify.toast) {
    window.shopify.toast.show(message, {
      duration: 5000,
      isError: isError
    });
  } else {
    // Fallback to alert if Shopify toast is not available
    if (isError) {
      alert('Error: ' + message);
    } else {
      console.log('INFO:', message);
    }
  }
}

// Form submission helpers
async function submitForm(url, data, method = 'POST') {
  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Form submission error:', error);
    throw error;
  }
}

// Handle category form submission
async function handleCategorySubmit(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // Add shop and host params to the action URL
  const urlParams = new URLSearchParams(window.location.search);
  const shop = urlParams.get('shop');
  const host = urlParams.get('host');

  let actionUrl = form.action;
  if (shop) {
    const separator = actionUrl.includes('?') ? '&' : '?';
    actionUrl += `${separator}shop=${encodeURIComponent(shop)}`;
    if (host) {
      actionUrl += `&host=${encodeURIComponent(host)}`;
    }
  }

  try {
    const result = await submitForm(actionUrl, data, form.method);

    if (result.success) {
      showToast('Category saved successfully');
      setTimeout(() => {
        navigate('/app/categories');
      }, 1000);
    } else {
      showToast('Error saving category: ' + result.error, true);
    }
  } catch (error) {
    showToast('Error saving category', true);
  }
}

// Handle item form submission
async function handleItemSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);

  // Add shop and host params to the action URL
  const urlParams = new URLSearchParams(window.location.search);
  const shop = urlParams.get('shop');
  const host = urlParams.get('host');

  let actionUrl = form.action;
  if (shop) {
    const separator = actionUrl.includes('?') ? '&' : '?';
    actionUrl += `${separator}shop=${encodeURIComponent(shop)}`;
    if (host) {
      actionUrl += `&host=${encodeURIComponent(host)}`;
    }
  }

  console.log('Submitting item form to:', actionUrl);

  try {
    const response = await fetch(actionUrl, {
      method: form.method,
      body: formData
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error:', errorText);
      showToast('Error saving item: Server returned ' + response.status, true);
      return;
    }

    const result = await response.json();
    console.log('Response data:', result);

    if (result.success) {
      // Check if image needs processing
      const hasImage = formData.get('image') && formData.get('image').size > 0;

      if (hasImage && result.item.shopify_file_id && !result.item.image_url) {
        // Image uploaded but URL not ready yet - show processing overlay
        showToast('Item saved! Processing image...', false);

        // Show loading overlay
        const overlay = document.getElementById('image-processing-overlay');
        if (overlay) {
          overlay.style.display = 'flex';
        }

        // Wait 5 seconds then fetch the image URL
        setTimeout(async () => {
          try {
            const fetchUrl = `/api/fetch-image-url?shop=${encodeURIComponent(shop)}${host ? '&host=' + encodeURIComponent(host) : ''}`;
            const imageResponse = await fetch(fetchUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileId: result.item.shopify_file_id,
                itemId: result.item.id
              })
            });

            const imageResult = await imageResponse.json();
            console.log('Image URL fetch result:', imageResult);

            // Hide loading overlay
            const overlay = document.getElementById('image-processing-overlay');
            if (overlay) {
              overlay.style.display = 'none';
            }

            if (imageResult.success) {
              showToast('Image ready! Redirecting...', false);
              setTimeout(() => {
                const categoryId = form.dataset.categoryId;
                navigate(`/app/categories/${categoryId}/items`);
              }, 1000);
            } else {
              showToast('Item saved, but image still processing', false);
              setTimeout(() => {
                const categoryId = form.dataset.categoryId;
                navigate(`/app/categories/${categoryId}/items`);
              }, 1500);
            }
          } catch (error) {
            console.error('Error fetching image URL:', error);

            // Hide loading overlay
            const overlay = document.getElementById('image-processing-overlay');
            if (overlay) {
              overlay.style.display = 'none';
            }

            showToast('Item saved successfully', false);
            setTimeout(() => {
              const categoryId = form.dataset.categoryId;
              navigate(`/app/categories/${categoryId}/items`);
            }, 1500);
          }
        }, 5000); // 5 second delay
      } else if (result.warning) {
        showToast('Item saved but ' + result.warning, true);
        console.warn('Upload warning:', result.warning);
        setTimeout(() => {
          const categoryId = form.dataset.categoryId;
          navigate(`/app/categories/${categoryId}/items`);
        }, 1500);
      } else {
        showToast('Item saved successfully');
        setTimeout(() => {
          const categoryId = form.dataset.categoryId;
          navigate(`/app/categories/${categoryId}/items`);
        }, 1500);
      }
    } else {
      showToast('Error saving item: ' + result.error, true);
    }
  } catch (error) {
    console.error('Item submit error:', error);
    showToast('Error saving item: ' + error.message, true);
  }
}

// Delete confirmation
function confirmDelete(message, callback) {
  if (confirm(message)) {
    callback();
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  console.log('Shopify App initialized');

  // Add event listeners for forms if they exist
  const categoryForm = document.getElementById('category-form');
  if (categoryForm) {
    categoryForm.addEventListener('submit', handleCategorySubmit);
  }

  const itemForm = document.getElementById('item-form');
  if (itemForm) {
    itemForm.addEventListener('submit', handleItemSubmit);
  }
});
