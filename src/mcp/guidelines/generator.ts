/**
 * Guidelines Generator
 * Generates code guidelines for non-Quikim features
 */

export interface GuidelineContext {
  featureName: string;
  featureDescription: string;
  requirements: string;
  techStack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    mobile?: string[];
  };
  existingCode?: string;
  codeGuidelines?: string;
}

export interface GeneratedGuideline {
  title: string;
  overview: string;
  architecture: string;
  implementation: string[];
  bestPractices: string[];
  testing: string[];
  security: string[];
  references: string[];
}

/**
 * Generate guidelines for a non-Quikim feature
 */
export function generateFeatureGuidelines(context: GuidelineContext): GeneratedGuideline {
  return {
    title: `Implementation Guidelines: ${context.featureName}`,
    overview: generateOverview(context),
    architecture: generateArchitecture(context),
    implementation: generateImplementationSteps(context),
    bestPractices: generateBestPractices(context),
    testing: generateTestingGuidelines(context),
    security: generateSecurityGuidelines(context),
    references: generateReferences(context),
  };
}

/**
 * Generate overview section
 */
function generateOverview(context: GuidelineContext): string {
  return `
## Overview

Feature: ${context.featureName}
Description: ${context.featureDescription}

This feature should be implemented following the project's architecture and coding standards.
The implementation should integrate seamlessly with the existing codebase and follow best practices
for ${context.techStack.backend?.join(', ')} backend and ${context.techStack.frontend?.join(', ')} frontend.

Requirements:
${context.requirements}
`;
}

/**
 * Generate architecture section
 */
function generateArchitecture(context: GuidelineContext): string {
  const { techStack } = context;
  
  let architecture = `
## Architecture

### Backend Architecture
`;

  if (techStack.backend?.includes('Express') || techStack.backend?.includes('Node.js')) {
    architecture += `
- Use Express.js router for API endpoints
- Implement service layer for business logic
- Use Prisma for database operations
- Follow RESTful API design principles
- Implement proper error handling middleware
`;
  }

  architecture += `
### Frontend Architecture
`;

  if (techStack.frontend?.includes('Next.js') || techStack.frontend?.includes('React')) {
    architecture += `
- Use React components with proper state management
- Implement API calls using fetch or axios
- Use React hooks for side effects
- Follow component composition patterns
- Implement proper error boundaries
`;
  }

  if (techStack.database?.includes('Prisma') || techStack.database?.includes('PostgreSQL')) {
    architecture += `
### Database Architecture
- Define Prisma models for data entities
- Implement proper relationships and constraints
- Use migrations for schema changes
- Index frequently queried fields
- Implement soft deletes where appropriate
`;
  }

  return architecture;
}

/**
 * Generate implementation steps
 */
function generateImplementationSteps(context: GuidelineContext): string[] {
  const steps: string[] = [];
  const { techStack } = context;

  // Database steps
  if (techStack.database?.includes('Prisma')) {
    steps.push('1. Define Prisma models in schema.prisma for all data entities');
    steps.push('2. Run prisma migrate dev to create database tables');
  }

  // Backend steps
  if (techStack.backend?.includes('Express') || techStack.backend?.includes('Node.js')) {
    steps.push('3. Create service layer classes for business logic');
    steps.push('4. Implement API routes in Express router');
    steps.push('5. Add validation middleware for request data');
    steps.push('6. Implement error handling middleware');
    steps.push('7. Add authentication/authorization checks');
  }

  // Frontend steps
  if (techStack.frontend?.includes('Next.js') || techStack.frontend?.includes('React')) {
    steps.push('8. Create React components for UI');
    steps.push('9. Implement API client functions');
    steps.push('10. Add state management (Context API or Redux)');
    steps.push('11. Implement form validation');
    steps.push('12. Add loading and error states');
  }

  // Testing steps
  steps.push('13. Write unit tests for service layer');
  steps.push('14. Write integration tests for API endpoints');
  steps.push('15. Write E2E tests for critical user flows');

  return steps;
}

/**
 * Generate best practices
 */
function generateBestPractices(context: GuidelineContext): string[] {
  const practices: string[] = [
    'Follow the Single Responsibility Principle - each function/class should have one clear purpose',
    'Use TypeScript types/interfaces for all data structures',
    'Implement proper error handling with try-catch blocks',
    'Add logging for debugging and monitoring',
    'Use environment variables for configuration',
    'Follow the project\'s existing code style and conventions',
    'Write self-documenting code with clear variable/function names',
    'Add JSDoc comments for complex functions',
    'Keep functions small and focused (< 50 lines)',
    'Use async/await instead of callbacks',
  ];

  if (context.codeGuidelines) {
    practices.push(`Follow project-specific guidelines: ${context.codeGuidelines}`);
  }

  return practices;
}

/**
 * Generate testing guidelines
 */
function generateTestingGuidelines(_context: GuidelineContext): string[] {
  return [
    'Write unit tests for all service layer functions',
    'Test both success and error cases',
    'Mock external dependencies (database, APIs)',
    'Aim for >80% code coverage',
    'Write integration tests for API endpoints',
    'Test authentication and authorization',
    'Write E2E tests for critical user flows',
    'Use test fixtures for consistent test data',
    'Run tests before committing code',
  ];
}

/**
 * Generate security guidelines
 */
function generateSecurityGuidelines(_context: GuidelineContext): string[] {
  return [
    'Validate and sanitize all user inputs',
    'Use parameterized queries to prevent SQL injection',
    'Implement proper authentication and authorization',
    'Use HTTPS for all API communications',
    'Store sensitive data encrypted',
    'Never commit secrets or API keys to version control',
    'Implement rate limiting for API endpoints',
    'Use CSRF tokens for state-changing operations',
    'Implement proper session management',
    'Follow OWASP security best practices',
  ];
}

/**
 * Generate references
 */
function generateReferences(context: GuidelineContext): string[] {
  const references: string[] = [];
  const { techStack } = context;

  if (techStack.backend?.includes('Express')) {
    references.push('Express.js Documentation: https://expressjs.com/');
  }

  if (techStack.frontend?.includes('Next.js')) {
    references.push('Next.js Documentation: https://nextjs.org/docs');
  }

  if (techStack.frontend?.includes('React')) {
    references.push('React Documentation: https://react.dev/');
  }

  if (techStack.database?.includes('Prisma')) {
    references.push('Prisma Documentation: https://www.prisma.io/docs');
  }

  references.push('TypeScript Documentation: https://www.typescriptlang.org/docs/');
  references.push('MDN Web Docs: https://developer.mozilla.org/');

  return references;
}

/**
 * Format guidelines as markdown
 */
export function formatGuidelinesAsMarkdown(guidelines: GeneratedGuideline): string {
  let markdown = `# ${guidelines.title}\n\n`;
  
  markdown += guidelines.overview + '\n\n';
  markdown += guidelines.architecture + '\n\n';
  
  markdown += '## Implementation Steps\n\n';
  guidelines.implementation.forEach(step => {
    markdown += `${step}\n`;
  });
  markdown += '\n';
  
  markdown += '## Best Practices\n\n';
  guidelines.bestPractices.forEach(practice => {
    markdown += `- ${practice}\n`;
  });
  markdown += '\n';
  
  markdown += '## Testing Guidelines\n\n';
  guidelines.testing.forEach(test => {
    markdown += `- ${test}\n`;
  });
  markdown += '\n';
  
  markdown += '## Security Guidelines\n\n';
  guidelines.security.forEach(security => {
    markdown += `- ${security}\n`;
  });
  markdown += '\n';
  
  markdown += '## References\n\n';
  guidelines.references.forEach(ref => {
    markdown += `- ${ref}\n`;
  });
  
  return markdown;
}

/**
 * Format guidelines as XML for MCP response
 */
export function formatGuidelinesAsXML(guidelines: GeneratedGuideline): string {
  return `
<guidelines>
  <title>${escapeXML(guidelines.title)}</title>
  <overview><![CDATA[${guidelines.overview}]]></overview>
  <architecture><![CDATA[${guidelines.architecture}]]></architecture>
  <implementation>
    ${guidelines.implementation.map(step => `<step><![CDATA[${step}]]></step>`).join('\n    ')}
  </implementation>
  <best_practices>
    ${guidelines.bestPractices.map(practice => `<practice><![CDATA[${practice}]]></practice>`).join('\n    ')}
  </best_practices>
  <testing>
    ${guidelines.testing.map(test => `<test><![CDATA[${test}]]></test>`).join('\n    ')}
  </testing>
  <security>
    ${guidelines.security.map(sec => `<security_item><![CDATA[${sec}]]></security_item>`).join('\n    ')}
  </security>
  <references>
    ${guidelines.references.map(ref => `<reference><![CDATA[${ref}]]></reference>`).join('\n    ')}
  </references>
</guidelines>
`;
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
