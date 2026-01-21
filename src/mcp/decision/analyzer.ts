/**
 * Context Analysis Functions
 * Analyzes codebase context without hardcoded assumptions
 */

import { CodebaseContext, FileInfo, ProjectStructure } from '../session/types.js';
import { AnalysisResult, ActionType } from '../types.js';

export class ContextAnalyzer {
  /**
   * Extracts technology stack from HLD file content
   * This is the PRIMARY source of tech stack information
   */
  private extractTechStackFromHLD(files: FileInfo[]): { 
    technologies: string[], 
    techStack: any,
    hasHLD: boolean 
  } {
    // Find HLD file in .quikim/v*/ version directories
    const hldFile = files.find(f => f.path.match(/\.quikim\/v\d+\/hld\.md/));
    
    if (!hldFile || !hldFile.content) {
      return { technologies: [], techStack: {}, hasHLD: false };
    }

    const technologies: string[] = [];
    const techStack: any = {
      frontend: [],
      backend: [],
      database: [],
      mobile: []
    };

    const content = hldFile.content.toLowerCase();

    // Parse frontend technologies
    if (content.includes('next.js') || content.includes('nextjs')) {
      technologies.push('Next.js');
      techStack.frontend.push('Next.js');
    }
    if (content.includes('react')) {
      technologies.push('React');
      techStack.frontend.push('React');
    }
    if (content.includes('vue.js') || content.includes('vuejs')) {
      technologies.push('Vue.js');
      techStack.frontend.push('Vue.js');
    }
    if (content.includes('angular')) {
      technologies.push('Angular');
      techStack.frontend.push('Angular');
    }

    // Parse backend technologies
    if (content.includes('express')) {
      technologies.push('Express');
      techStack.backend.push('Express');
    }
    if (content.includes('node.js') || content.includes('nodejs')) {
      technologies.push('Node.js');
      techStack.backend.push('Node.js');
    }
    if (content.includes('nestjs') || content.includes('nest.js')) {
      technologies.push('NestJS');
      techStack.backend.push('NestJS');
    }
    if (content.includes('fastify')) {
      technologies.push('Fastify');
      techStack.backend.push('Fastify');
    }

    // Parse database technologies
    if (content.includes('prisma')) {
      technologies.push('Prisma');
      techStack.database.push('Prisma');
    }
    if (content.includes('postgresql') || content.includes('postgres')) {
      technologies.push('PostgreSQL');
      techStack.database.push('PostgreSQL');
    }
    if (content.includes('mongodb') || content.includes('mongo')) {
      technologies.push('MongoDB');
      techStack.database.push('MongoDB');
    }
    if (content.includes('mysql')) {
      technologies.push('MySQL');
      techStack.database.push('MySQL');
    }

    // Parse mobile technologies
    if (content.includes('flutter')) {
      technologies.push('Flutter');
      techStack.mobile.push('Flutter');
    }
    if (content.includes('react native')) {
      technologies.push('React Native');
      techStack.mobile.push('React Native');
    }

    // Parse language technologies
    if (content.includes('typescript')) {
      technologies.push('TypeScript');
    }
    if (content.includes('javascript')) {
      technologies.push('JavaScript');
    }

    return { 
      technologies, 
      techStack,
      hasHLD: true 
    };
  }

  /**
   * Analyzes codebase context based on actual files provided
   * Reads tech stack from HLD file content, not from file extension detection
   */
  analyzeCodebase(context: CodebaseContext): AnalysisResult {
    // First, try to extract tech stack from HLD file
    const techStackFromHLD = this.extractTechStackFromHLD(context.files);
    
    // If HLD provides tech stack, use it; otherwise detect from files
    const technologies = techStackFromHLD.technologies.length > 0 
      ? techStackFromHLD.technologies 
      : this.detectTechnologies(context.files);
    
    const projectType = this.inferProjectType(context.files, context.projectStructure);
    const confidence = this.calculateConfidence(context.files, technologies, techStackFromHLD.hasHLD);
    const missingInfo = this.identifyMissingInformation(context, techStackFromHLD.hasHLD);

    return {
      detectedTechnologies: technologies,
      techStack: techStackFromHLD.techStack, // Include structured tech stack
      projectType,
      suggestedActions: this.suggestActions(technologies, projectType, context, techStackFromHLD.hasHLD),
      confidence,
      requiresMoreInfo: missingInfo.length > 0,
      missingInfo: missingInfo.length > 0 ? missingInfo : undefined
    };
  }

  /**
   * Detects technology stack from actual file content and structure
   * FALLBACK ONLY - Primary source should be HLD file
   * Only used when HLD file is not available
   */
  private detectTechnologies(files: FileInfo[]): string[] {
    const technologies = new Set<string>();

    for (const file of files) {
      // Analyze file content for technology indicators (not extensions)
      const techFromContent = this.getTechnologyFromContent(file.content, file.path);
      techFromContent.forEach(tech => technologies.add(tech));
    }

    return Array.from(technologies);
  }

  /**
   * Analyzes file content for technology indicators
   */
  private getTechnologyFromContent(content: string, filePath: string): string[] {
    const technologies: string[] = [];

    // Check for package.json indicators
    if (filePath.endsWith('package.json')) {
      try {
        const packageData = JSON.parse(content);
        technologies.push(...this.analyzeDependencies(packageData));
      } catch {
        // Invalid JSON, skip analysis
      }
    }

    // Check for requirements.txt (Python)
    if (filePath.endsWith('requirements.txt')) {
      technologies.push('Python');
      technologies.push(...this.analyzePythonRequirements(content));
    }

    // Check for Cargo.toml (Rust)
    if (filePath.endsWith('Cargo.toml')) {
      technologies.push('Rust');
    }

    // Check for go.mod (Go)
    if (filePath.endsWith('go.mod')) {
      technologies.push('Go');
    }

    // Check for pom.xml (Java/Maven)
    if (filePath.endsWith('pom.xml')) {
      technologies.push('Java', 'Maven');
    }

    // Check for build.gradle (Java/Gradle)
    if (filePath.endsWith('build.gradle') || filePath.endsWith('build.gradle.kts')) {
      technologies.push('Java', 'Gradle');
    }

    // Analyze content patterns
    technologies.push(...this.analyzeContentPatterns(content));

    return technologies;
  }

  /**
   * Analyzes package.json dependencies to detect frameworks and libraries
   */
  private analyzeDependencies(packageData: any): string[] {
    const technologies: string[] = [];
    const allDeps = {
      ...packageData.dependencies,
      ...packageData.devDependencies,
      ...packageData.peerDependencies
    };

    // Framework detection
    if (allDeps.react) technologies.push('React');
    if (allDeps.vue) technologies.push('Vue.js');
    if (allDeps.angular || allDeps['@angular/core']) technologies.push('Angular');
    if (allDeps.svelte) technologies.push('Svelte');
    if (allDeps.next) technologies.push('Next.js');
    if (allDeps.nuxt) technologies.push('Nuxt.js');
    if (allDeps.express) technologies.push('Express.js');
    if (allDeps.fastify) technologies.push('Fastify');
    if (allDeps.nestjs || allDeps['@nestjs/core']) technologies.push('NestJS');

    // Testing frameworks
    if (allDeps.jest) technologies.push('Jest');
    if (allDeps.mocha) technologies.push('Mocha');
    if (allDeps.vitest) technologies.push('Vitest');
    if (allDeps.cypress) technologies.push('Cypress');

    // Build tools
    if (allDeps.webpack) technologies.push('Webpack');
    if (allDeps.vite) technologies.push('Vite');
    if (allDeps.rollup) technologies.push('Rollup');
    if (allDeps.parcel) technologies.push('Parcel');

    // Databases
    if (allDeps.mongoose) technologies.push('MongoDB');
    if (allDeps.pg || allDeps.postgres) technologies.push('PostgreSQL');
    if (allDeps.mysql || allDeps.mysql2) technologies.push('MySQL');
    if (allDeps.sqlite3) technologies.push('SQLite');

    return technologies;
  }

  /**
   * Analyzes Python requirements.txt for frameworks
   */
  private analyzePythonRequirements(content: string): string[] {
    const technologies: string[] = [];
    const lines = content.split('\n').map(line => line.trim().toLowerCase());

    for (const line of lines) {
      if (line.startsWith('django')) technologies.push('Django');
      if (line.startsWith('flask')) technologies.push('Flask');
      if (line.startsWith('fastapi')) technologies.push('FastAPI');
      if (line.startsWith('numpy')) technologies.push('NumPy');
      if (line.startsWith('pandas')) technologies.push('Pandas');
      if (line.startsWith('tensorflow')) technologies.push('TensorFlow');
      if (line.startsWith('pytorch')) technologies.push('PyTorch');
    }

    return technologies;
  }

  /**
   * Analyzes content patterns for technology indicators
   */
  private analyzeContentPatterns(content: string): string[] {
    const technologies: string[] = [];

    // React patterns
    if (content.includes('import React') || content.includes('from \'react\'') || content.includes('from "react"')) {
      technologies.push('React');
    }

    // Express.js patterns
    if (content.includes('require(\'express\')') || content.includes('require("express")') || 
        content.includes('from \'express\'') || content.includes('from "express"')) {
      technologies.push('Express.js');
    }

    // Vue patterns
    if (content.includes('<template>') && content.includes('<script>')) {
      technologies.push('Vue.js');
    }

    // Angular patterns
    if (content.includes('@Component') || content.includes('@Injectable')) {
      technologies.push('Angular');
    }

    // Docker
    if (content.includes('FROM ') && content.includes('RUN ')) {
      technologies.push('Docker');
    }

    // SQL patterns
    if (content.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\b/i)) {
      technologies.push('SQL');
    }

    return technologies;
  }

  /**
   * Infers project type from files and structure
   */
  private inferProjectType(files: FileInfo[], structure: ProjectStructure): string {
    const fileTypes = structure.fileTypes;
    const packageFiles = structure.packageFiles;

    // Web application indicators
    if (packageFiles.some(f => f.includes('package.json'))) {
      if (files.some(f => f.path.includes('src/') || f.path.includes('components/'))) {
        return 'Web Application';
      }
      return 'Node.js Project';
    }

    // Python project indicators
    if (packageFiles.some(f => f.includes('requirements.txt') || f.includes('setup.py'))) {
      return 'Python Project';
    }

    // Java project indicators
    if (packageFiles.some(f => f.includes('pom.xml') || f.includes('build.gradle'))) {
      return 'Java Project';
    }

    // Go project indicators
    if (packageFiles.some(f => f.includes('go.mod'))) {
      return 'Go Project';
    }

    // Rust project indicators
    if (packageFiles.some(f => f.includes('Cargo.toml'))) {
      return 'Rust Project';
    }

    // Mobile app indicators
    if (files.some(f => f.path.includes('android/') || f.path.includes('ios/'))) {
      return 'Mobile Application';
    }

    // Default based on file distribution
    const totalFiles = Object.values(fileTypes).reduce((sum, count) => sum + count, 0);
    if (totalFiles === 0) return 'Empty Project';

    return 'General Project';
  }

  /**
   * Calculates confidence level based on available information
   * Higher confidence when HLD file is present
   */
  private calculateConfidence(files: FileInfo[], technologies: string[], hasHLD: boolean): number {
    let confidence = 0;

    // High confidence if HLD file provides tech stack
    if (hasHLD && technologies.length > 0) {
      confidence = 0.9; // Very high confidence from HLD
      return confidence;
    }

    // Lower confidence without HLD - fallback detection
    // Base confidence from file count
    confidence += Math.min(files.length * 0.15, 0.6);

    // Confidence from detected technologies
    confidence += Math.min(technologies.length * 0.15, 0.4);

    // Confidence from file content analysis
    const hasContent = files.some(f => f.content.length > 50);
    if (hasContent) confidence += 0.3;

    // Bonus for package files
    const hasPackageFile = files.some(f => 
      f.path.includes('package.json') || 
      f.path.includes('requirements.txt') ||
      f.path.includes('Cargo.toml')
    );
    if (hasPackageFile) confidence += 0.2;

    return Math.min(confidence, 0.7); // Cap at 0.7 without HLD
  }

  /**
   * Identifies missing information needed for better analysis
   * Prioritizes HLD file for tech stack information
   */
  private identifyMissingInformation(context: CodebaseContext, hasHLD: boolean): string[] {
    const missing: string[] = [];

    // Check for HLD file first - it's the primary source of tech stack
    if (!hasHLD) {
      missing.push('.quikim/v*/hld.md file (contains technology stack and architecture)');
    }

    // Check for essential project files with meaningful content
    const hasPackageFile = context.files.some(f => 
      (f.path.includes('package.json') || 
       f.path.includes('requirements.txt') ||
       f.path.includes('Cargo.toml') ||
       f.path.includes('go.mod') ||
       f.path.includes('pom.xml') ||
       f.path.includes('lerna.json')) && // Include monorepo config files
      f.content.trim().length > 10 // Must have meaningful content
    );

    if (!hasPackageFile && context.files.length < 3) {
      missing.push('Project configuration files (package.json, requirements.txt, etc.)');
    }

    // Check for source code files - be more lenient but require some content
    const hasSourceCode = context.files.some(f => 
      f.content.trim().length > 10 && 
      !f.path.includes('node_modules') &&
      !f.path.includes('package.json') && // Package files are not source code
      !f.path.includes('requirements.txt') &&
      !f.path.includes('Cargo.toml') &&
      !f.path.includes('go.mod') &&
      !f.path.includes('pom.xml')
    );

    if (!hasSourceCode) {
      missing.push('Source code files');
    }

    // Check for project structure - only if completely empty
    if (context.projectStructure.directories.length === 0 && context.files.length === 0) {
      missing.push('Project directory structure');
    }

    return missing;
  }

  /**
   * Suggests actions based on analysis results
   * Prioritizes requesting HLD if missing
   */
  private suggestActions(technologies: string[], projectType: string, context: CodebaseContext, hasHLD: boolean): ActionType[] {
    const actions: ActionType[] = [];

    // If missing HLD file, request it first
    if (!hasHLD) {
      actions.push('request_info');
      return actions;
    }

    // If missing critical information, request it
    const missingInfo = this.identifyMissingInformation(context, hasHLD);
    const hasCriticalMissing = missingInfo.some(info => 
      info.includes('Source code files') || 
      (info.includes('Project configuration') && context.files.length === 0)
    );
    
    if (hasCriticalMissing) {
      actions.push('request_info');
      return actions;
    }

    // Suggest actions based on project type and technologies
    if (projectType.includes('Web Application')) {
      actions.push('read_files'); // Read main application files
      if (technologies.includes('React') || technologies.includes('Vue.js')) {
        actions.push('run_command'); // Run build or test commands
      }
    }

    if (projectType.includes('Node.js')) {
      actions.push('read_files'); // Read package.json and main files
      actions.push('run_command'); // Run npm/yarn commands
    }

    // If we have some files but missing package config, still proceed with reading
    if (context.files.length > 0 && actions.length === 0) {
      actions.push('read_files');
    }

    // Default actions if no specific suggestions
    if (actions.length === 0) {
      actions.push('read_files');
    }

    return actions;
  }
}