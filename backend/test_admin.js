const pool = require('./src/config/db');
pool
  .query("SELECT email, role FROM users WHERE email='admin@internops.com'")
  .then((res) => {
    console.log(JSON.stringify(res.rows));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
