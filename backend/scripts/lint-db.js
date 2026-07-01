const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.join(__dirname, '..', 'src', 'modules');
let leaked = false;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (stat.isFile() && file.endsWith('.js')) {
      // Exclude files that are repositories
      if (
        file.toLowerCase().includes('repository') ||
        file.toLowerCase().includes('repo')
      ) {
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('pool.query') || content.includes('config/db')) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (
            lines[i].includes('pool.query') ||
            lines[i].includes('config/db')
          ) {
            console.error(
              `Violations: pool.query or config/db leaked in non-repository file: ${path.relative(
                path.join(__dirname, '..'),
                fullPath
              )} at line ${i + 1}: ${lines[i].trim()}`
            );
            leaked = true;
          }
        }
      }
    }
  }
}

console.log('Scanning non-repository modules for database leakages...');
scanDir(MODULES_DIR);

if (leaked) {
  console.error(
    'Lint check failed: pool.query leaked into module routes/logic!'
  );
  process.exit(1);
} else {
  console.log('All modules clean. Database leak check passed.');
  process.exit(0);
}
