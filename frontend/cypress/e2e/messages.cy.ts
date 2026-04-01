describe('Messages / Chat Page', () => {
  beforeEach(() => {
    cy.viewport(1400, 720);

    cy.loginByLocalStorage();
    cy.visit('/messages');
  });

  it('should load the chat page', () => {
    // ChatPage renders ChatSidebar + NoChatSelected or ChatContainer
    cy.get('body').should('not.contain', 'An error has occurred');
  });

  it('should show the contacts sidebar', () => {
    // ChatSidebar renders aside with "Contacts" text
    cy.contains('Contacts', { timeout: 6000 }).should('exist');
  });

  it('should show the search contacts input', () => {
    // ChatSidebar has input placeholder "Search contacts..."
    cy.get('input[placeholder="Search contacts..."]', { timeout: 6000 }).should('exist');
  });

  it('should filter contacts when typing in search', () => {
    cy.get('input[placeholder="Search contacts..."]', { timeout: 6000 }).type('zzzznotauser');
    // ChatSidebar: sortedFriends.length === 0 with query → "No contacts found"
    cy.contains('No contacts found', { timeout: 4000 }).should('exist');
  });

  it('should clear search and restore contacts', () => {
    cy.get('input[placeholder="Search contacts..."]').type('zzzznotauser');
    cy.contains('No contacts found').should('exist');
    cy.get('input[placeholder="Search contacts..."]').clear();
    // back to normal — either contacts or "No online users"
    cy.get('body').should('satisfy', ($body: JQuery<HTMLBodyElement>) => {
      return $body.text().includes('No online users') || $body.find('button img').length > 0;
    });
  });

  it('should show NoChatSelected when no user is selected', () => {
    // ChatPage: !selectedUser → <NoChatSelected />
    // NoChatSelected typically has some placeholder text
    cy.get('aside').should('exist');
    // no ChatContainer visible
    cy.get('body').should('not.contain', 'Type a message');
  });

  it('should redirect to login if not authenticated', () => {
    cy.clearLocalStorage();
    cy.visit('/messages');
    cy.url().should('not.include', '/messages');
  });
});
