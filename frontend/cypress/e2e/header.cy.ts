/// <reference types="cypress" />

describe('Header / Navbar', () => {
  beforeEach(() => {
    cy.viewport(1400, 720);
    cy.loginByLocalStorage();
    cy.visit('/');
  });

  it('should show the full navbar when logged in', () => {
    // Look for the specific navigation container
    cy.get('nav').should('be.visible');
  });

  it('should navigate to messages when chat icon is clicked', () => {
    // Target by href directly for NavLinks
    cy.get('a[href="/messages"]').should('be.visible').click();
    cy.url().should('include', '/messages');
  });

  it('should navigate to home when logo/name is clicked', () => {
    cy.visit('/messages');
    // Using the aria-label we added in step 1
    cy.get('button[aria-label="go-to-home"]').click();
    cy.url().should('eq', Cypress.config('baseUrl') + '/');
  });

  it('should open notifications dropdown when bell is clicked', () => {
    // Target the specific bell button
    cy.get('button[aria-label="notifications-bell"]').should('be.visible').click();

    // Notifications.tsx renders "Notifications" in the DropdownMenuLabel
    cy.contains('span', 'Notifications').should('be.visible');
  });

  it('should show language toggle button', () => {
    // SearchBar.tsx and others use i18next
    // Check if the button contains either EN or DE
    cy.get('button').contains(/EN|DE/i).should('exist');
  });

  it('should handle the search bar input', () => {
    // SearchBar.tsx uses a placeholder from translations
    // We target the input and type a query
    cy.get('input').first().type('vinjak');
    // Check if dropdown results appear
    cy.get('.search-drawer').should('exist');
  });
});
