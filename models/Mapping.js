//Define Sequelize models for projects, backers, and product mappings.
//Location /models
// Mapping.js
const Mapping = sequelize.define('Mapping', {
  projectId: { type: DataTypes.INTEGER, references: { model: 'Projects', key: 'id' } },
  kickstarterName: { type: DataTypes.STRING },
  shopifyProductId: { type: DataTypes.STRING },
  sku: { type: DataTypes.STRING },

});