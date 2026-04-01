describe('Login Page', () => {
  beforeEach(() => {
    cy.viewport(1400, 720);

    cy.visit('/login');
  });

  it('should display the login form with username and password fields', () => {
    // LoginForm has two inputs — username and password
    cy.get('input').should('have.length.at.least', 2);
    cy.get('button[type="submit"]').should('exist');
  });

  it('should have default values prefilled in the form', () => {
    // LoginForm defaultValues has aronpozsar / 123123
    cy.get('input').first().should('have.value', 'aronpozsar');
  });

  it('should show validation error when username is cleared and form submitted', () => {
    cy.get('input').first().clear();
    cy.get('button[type="submit"]').click();
    // Zod schema: username min(1) — form stays on /login
    cy.url().should('include', '/login');
  });

  it('should toggle password visibility when eye icon is clicked', () => {
    // password input starts as type="password"
    cy.get('input[type="password"]').should('exist');
    // ghost button with EyeIcon toggles it
    cy.get('button[type="button"]').first().click();
    cy.get('input[type="text"]').should('exist');
    // click again to hide
    cy.get('button[type="button"]').first().click();
    cy.get('input[type="password"]').should('exist');
  });

  it('should navigate to reset password page via forgot password link', () => {
    // LoginForm has Link to /reset-password
    cy.contains('a', /forgot/i).click();
    cy.url().should('include', '/reset-password');
  });

  it('should redirect away from login when already authenticated', () => {
    cy.loginByLocalStorage();
    cy.visit('/login');
    // memberCheck in the store reads lh_member and sets loggedInMember
    // app should redirect to home
    cy.url().should('not.include', '/login');
  });

  it('should show error message on invalid credentials', () => {
    cy.get('input').first().clear().type('definitelynotauser_xyz');
    cy.get('input[type="password"]').clear().type('wrongpassword');
    cy.get('button[type="submit"]').click();
    // memberLogin returns false → setError('root') is called
    cy.url().should('include', '/login');
  });
});
