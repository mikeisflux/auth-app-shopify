const sequelize = require('./config/database');
const { Project, Backer, Mapping } = require('./models');

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully.');
    
    process.exit(0);
  } catch (error) {
    console.error('Unable to sync database:', error);
    process.exit(1);
  }
}

syncDatabase();