const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
});

const { activateTestDatabase } = require('../src/config/testDatabase');
activateTestDatabase();
