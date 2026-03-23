export default () => ({
  database: process.env.DB_NAME || 'leaves_db',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
});