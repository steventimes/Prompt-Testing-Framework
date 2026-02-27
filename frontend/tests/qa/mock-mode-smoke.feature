Feature: Frontend mock-mode readiness
  As a QA engineer
  I want predictable frontend behavior in mock mode
  So releases can proceed without backend dependencies

  Background:
    Given the frontend is built with VITE_USE_MOCK=true

  Scenario: User can run a quick playground test
    When the user enters a question in Quick Playground
    And the user clicks "Run Quick Test"
    Then a mock response should be shown
    And run metadata should be added to session history

  Scenario: Session data survives refresh for current browser tab
    Given the user has executed at least one quick test
    When the user refreshes the website
    Then history should still be visible
    But closing the browser session should clear it

  Scenario: Prompt detail recovers in-session run context
    Given the user opens a prompt detail page
    When the user runs a prompt test
    And refreshes the page
    Then selected version, model, and inputs should be restored
