//Define Sequelize models for projects, backers, and product mappings.
//Location /models
// Backer.js
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