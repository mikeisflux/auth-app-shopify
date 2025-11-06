//Location //services
const { Shopify } = require('@shopify/shopify-api');
const { Backer, Mapping } = require('../models');

async function importOrders(session, projectId, selectedBackerIds) {
  const client = new Shopify.Clients.Rest(session.shop, session.accessToken);
  const mappings = await Mapping.findAll({ where: { projectId } });
  const backers = await Backer.findAll({ where: { id: selectedBackerIds, projectId } });

  const results = { success: [], failed: [] };

  for (const backer of backers) {
    try {
      const lineItems = [
        ...(backer.reward ? [{
          variant_id: mappings.find(m => m.kickstarterName === backer.reward.name)?.shopifyProductId,
          quantity: backer.reward.quantity || 1,
        }] : []),
        ...(backer.addOns || []).map(addOn => ({
          variant_id: mappings.find(m => m.kickstarterName === addOn.name)?.shopifyProductId,
          quantity: addOn.quantity || 1,
        })),
      ].filter(item => item.variant_id && item.quantity > 0);

      const order = await client.post({
        path: 'orders',
        data: {
          order: {
            email: backer.email,
            financial_status: 'paid',
            fulfillment_status: 'fulfilled',
            tags: 'Kickstarter',
            line_items: lineItems,
            buyer_accepts_marketing: true,
            note: backer.notes,
            name: `KS-${backer.backerNumber.padStart(10, '0')}`,
          },
        },
      });

      await Backer.update({ imported: true }, { where: { id: backer.id } });
      results.success.push(backer.id);
    } catch (error) {
      const reason = error.response ? `${error.message} (Code: ${error.response.code})` : error.message;
      results.failed.push({ id: backer.id, reason });
    }
  }

  return results;
}

module.exports = { importOrders };