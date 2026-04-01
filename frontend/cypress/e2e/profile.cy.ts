describe('My Profile Page', () => {
  beforeEach(() => {
    cy.loginByLocalStorage();
    cy.visit('/profile');
  });
  // Use the same TEST_MEMBER username for member profile test
  const TEST_MEMBER_FIRSTNAME = 'Aron';

  it('should load the profile page', () => {
    // Profile.tsx renders when loggedInMember is set from localStorage via memberCheck
    cy.get('body').should('not.contain', 'Loading profile...');
  });

  it('should display the logged in user first name', () => {
    // Profile.tsx: "About {loggedInMember?.firstName}"
    cy.contains(TEST_MEMBER_FIRSTNAME, { timeout: 6000 }).should('exist');
  });

  it('should show Posts and About tabs', () => {
    // Profile.tsx has two tab buttons
    cy.contains('button', 'Posts').should('exist');
    cy.contains('button', 'About').should('exist');
  });

  it('should switch to About tab when clicked', () => {
    cy.contains('button', 'About').click();
    // About tab renders "About {firstName}" heading and member since section
    cy.contains('Member Since', { timeout: 4000 }).should('exist');
  });

  it('should switch back to Posts tab when clicked', () => {
    cy.contains('button', 'About').click();
    cy.contains('button', 'Posts').click();
    // Posts tab shows either post grid or "No posts yet"
    cy.get('body').should('satisfy', ($body: JQuery<HTMLBodyElement>) => {
      return $body.text().includes('No posts yet') || $body.find('img[alt="Post"]').length > 0;
    });
  });

  it('should have an Edit Profile link', () => {
    // ProfileHeader renders Link to /edit-profile
    cy.contains('a', /edit\s*profile/i, { timeout: 6000 }).should('exist');
  });
});

describe('Member Profile Page', () => {
  beforeEach(() => {
    cy.loginByLocalStorage();
    // Visit another user's profile — replace with a real username in your DB
    cy.visit('/members/vinjaklorddd');
  });

  it('should load the member profile', () => {
    cy.get('body').should('not.contain', '404');
    cy.contains('Posts', { timeout: 8000 }).should('exist');
  });

  it('should show Posts and About tabs', () => {
    cy.contains('button', 'Posts', { timeout: 6000 }).should('exist');
    cy.contains('button', 'About', { timeout: 6000 }).should('exist');
  });

  it('should show the username on the profile', () => {
    // MemberProfile.tsx: <p>@{user?.username}</p>
    cy.contains('@vinjaklorddd', { timeout: 6000 }).should('exist');
  });

  it('should show Edit Profile button when viewing own profile', () => {
    // MemberProfile.tsx: isMe → Link "Edit Profile"
    // Only true if the visited username matches loggedInMember
    cy.loginByLocalStorage();
    cy.visit(`/members/vinjaklorddd`);
    cy.contains('Edit Profile', { timeout: 6000 }).should('exist');
  });

  it('should show About tab content', () => {
    cy.contains('button', 'About').click();
    cy.contains('Member Since', { timeout: 4000 }).should('exist');
  });
});
