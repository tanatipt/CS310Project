const { Pool } = require("pg");
const pool = new Pool({
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "postgres",
  database: "test",
});

module.exports = pool;
