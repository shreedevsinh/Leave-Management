export default () => ({
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'secret',
});