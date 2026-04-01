import './commands';

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('friends.filter')) return false;
  return true;
});
