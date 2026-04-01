/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Cypress {
    interface Chainable {
      loginByLocalStorage(): Chainable<void>;
    }
  }
}

// Paste a real token from your app (F12 → Application → localStorage → lh_token)
// and the corresponding lh_member object
const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NTU4MTJiZWE1MWM5ZjkwMTJkZmQwOCIsImlhdCI6MTc3NDk1ODUzOSwiZXhwIjoxNzc1NTYzMzM5fQ.WMoYPEJbtFw3LY_lGFVEmNCGWLw_bEZfRmnbOll7M-M';

const TEST_MEMBER = {
  _id: '6855812bea51c9f9012dfd08',
  username: 'vinjaklorddd',
  email: 'aaaronpozsar@gmail.com',
  firstName: 'Aron',
  lastName: 'Pozzzar',
};

Cypress.Commands.add('loginByLocalStorage', () => {
  // Use cy.on('window:before:load') to inject storage before React starts
  cy.on('window:before:load', (win) => {
    win.localStorage.setItem('lh_token', TEST_TOKEN);
    win.localStorage.setItem('lh_member', JSON.stringify(TEST_MEMBER));
  });
});

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('friends.filter')) return false;
  return true;
});
