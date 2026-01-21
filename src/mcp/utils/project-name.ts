/**
 * Project Name Utility
 * Safely extracts project name from codebase context
 */

import { CodebaseContext } from '../session/types.js';

/**
 * Extract project name from codebase
 * Handles cases where projectStructure might be undefined
 */
export function extractProjectName(codebase: CodebaseContext): string {
  // Try to get from projectStructure if available
  if (codebase.projectStructure?.rootPath) {
    const name = codebase.projectStructure.rootPath.split('/').pop();
    if (name && name !== '') {
      return name;
    }
  }

  // Fallback: Infer from .quikim file paths
  if (codebase.files && codebase.files.length > 0) {
    const quikimFile = codebase.files.find(f => f.path.includes('.quikim/'));
    if (quikimFile) {
      const pathParts = quikimFile.path.split('/');
      const quikimIndex = pathParts.findIndex(p => p === '.quikim');
      if (quikimIndex > 0) {
        const projectName = pathParts[quikimIndex - 1];
        if (projectName && projectName !== '') {
          return projectName;
        }
      }
    }

    // Try to infer from any file path
    const firstFile = codebase.files[0];
    if (firstFile && firstFile.path) {
      const pathParts = firstFile.path.split('/');
      // Skip common root directories
      const skipDirs = ['', '.', '..', 'src', 'app', 'pages', 'components'];
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const part = pathParts[i];
        if (part && !skipDirs.includes(part) && !part.startsWith('.')) {
          return part;
        }
      }
    }
  }

  // Default fallback
  return 'project';
}
