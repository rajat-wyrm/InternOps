const fs = require('fs');
const path = require('path');

const moduleName = process.argv[2];

if (!moduleName) {
  console.error('Usage: npm run generate:module -- <module-name>');
  process.exit(1);
}

const moduleDir = path.join(__dirname, '..', 'src', 'modules', moduleName);

if (fs.existsSync(moduleDir)) {
  console.error(`Module "${moduleName}" already exists.`);
  process.exit(1);
}

fs.mkdirSync(moduleDir, { recursive: true });

const files = {
  'routes.js': `module.exports = async function ${moduleName}Routes(fastify) {
  // Define ${moduleName} routes here
};
`,
  'service.js': `module.exports = {
  // Add business logic here
};
`,
  'repository.js': `const pool = require('../../config/db');

module.exports = {
  // Add database queries here
};
`,
};

for (const [fileName, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(moduleDir, fileName), content);
}

console.log(`Module "${moduleName}" created successfully.`);
