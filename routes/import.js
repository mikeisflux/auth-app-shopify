//HANDLE PRODUCT MAPPING AND SKU EDITING
//Location /routes
const express = require('express');
const router = express.Router();
const { Mapping, Backer } = require('../models');

router.get('/project/:id/mappings', async (req, res) => {
  const backers = await Backer.findAll({ where: { projectId: req.params.id } });
  const products = [...new Set(
    backers.flatMap(b => [b.reward, ...(b.addOns || [])]).map(p => ({ name: p.name, sku: p.sku }))
  )];
  res.json(products);
});

router.post('/project/:id/mappings', async (req, res) => {
  const mappings = req.body.mappings; // [{ kickstarterName, shopifyProductId, sku }]
  await Mapping.bulkCreate(
    mappings.map(m => ({ ...m, projectId: req.params.id }))
  );
  res.json({ success: true });
});

module.exports = router;

// Enhanced importOrders with rate-limit handling
async function importOrders(session, projectId, selectedBackerIds) {
  const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
  const backers = await Backer.findAll({ where: { id: selectedBackerIds, projectId } });
  const mappings = await Mapping.findAll({ where: { projectId } });
  const results = { success: [], failed: [] };

  for (const backer of backers) {
    try {
      // ... (line items construction as above)

      // Retry logic for rate limits
      let retries = 3;
      let success = false;
      let lastError = null;

      while (retries > 0 && !success) {
        try {
          const orderResponse = await client.post({
            path: 'orders',
            data: { order: { /* ... */ } },
            type: DataType.JSON,
          });
          await Backer.update({ imported: true }, { where: { id: backer.id } });
          results.success.push({ backerId: backer.id, orderId: orderResponse.body.order.id });
          success = true;
        } catch (error) {
          if (error.response?.code === 429) {
            // Rate limit hit, wait and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
            lastError = error;
          } else {
            throw error; // Non-rate-limit error, fail immediately
          }
        }
      }

      if (!success) {
        throw lastError || new Error('Max retries exceeded');
      }

    } catch (error) {
      results.failed.push({
        backerId: backer.id,
        reason: error.message || 'Unknown error',
      });
    }
  }

  return results;
}

// models/Backer.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Backer = sequelize.define('Backer', {
  projectId: { type: DataTypes.INTEGER, references: { model: 'Projects', key: 'id' } },
  name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  backerNumber: { type: DataTypes.STRING },
  reward: { type: DataTypes.JSON }, // { name, quantity, sku }
  addOns: { type: DataTypes.JSON }, // [{ name, quantity, sku }]
  pledgeAmount: { type: DataTypes.FLOAT },
  notes: { type: DataTypes.TEXT },
  imported: { type: DataTypes.BOOLEAN, defaultValue: false },
});

// models/Mapping.js
const Mapping = sequelize.define('Mapping', {
  projectId: { type: DataTypes.INTEGER, references: { model: 'Projects', key: 'id' } },
  kickstarterName: { type: DataTypes.STRING },
  shopifyProductId: { type: DataTypes.STRING },
  sku: { type: DataTypes.STRING },

// Add to existing routes/import.js
router.get('/project/:id/backers', validateSession, async (req, res) => {
  const { id: projectId } = req.params;
  try {
    const backers = await Backer.findAll({ where: { projectId } });
    res.json(backers);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch backers: ${error.message}` });
  }
});