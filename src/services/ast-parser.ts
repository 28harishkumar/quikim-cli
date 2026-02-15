/**
 * Quikim - AST Parser Service
 * 
 * Parses codebase files into Abstract Syntax Tree (AST) summaries.
 * Used for generating technical details (3.4), task prompts, and dependency mapping.
 * 
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 * Licensed under the AGPL-3.0 License.
 */

import * as ts from "typescript";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative, extname, dirname } from "path";
import ignore, { Ignore } from "ignore";
import { glob } from "glob";

// =============================================================================
// Types
// =============================================================================

export interface ImportInfo {
  name: string;
  source: string;
  resolvedPath?: string;
  isDefault: boolean;
  isNamespace: boolean;
}

export interface PropertyInfo {
  name: string;
  type: string;
  visibility: "public" | "private" | "protected";
  isStatic: boolean;
  isReadonly: boolean;
}

export interface MethodInfo {
  name: string;
  signature: string;
  parameters: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
  visibility: "public" | "private" | "protected";
  isStatic: boolean;
  isAsync: boolean;
  description?: string;
}

export interface ClassInfo {
  name: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
  extends?: string;
  implements: string[];
  isExported: boolean;
  description?: string;
}

export interface FunctionInfo {
  name: string;
  signature: string;
  parameters: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  description?: string;
}

export interface InterfaceInfo {
  name: string;
  properties: PropertyInfo[];
  methods: MethodInfo[];
  extends: string[];
  isExported: boolean;
}

export interface TypeAliasInfo {
  name: string;
  type: string;
  isExported: boolean;
}

export interface ExportInfo {
  name: string;
  type: "class" | "function" | "const" | "type" | "interface" | "enum" | "default" | "re-export";
  description?: string;
}

export interface ASTSummary {
  file: string;
  relativePath: string;
  language: "typescript" | "javascript" | "json" | "unknown";
  imports: ImportInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  interfaces: InterfaceInfo[];
  typeAliases: TypeAliasInfo[];
  exports: ExportInfo[];
  dependencies: string[];
  purpose?: string;
}

export type OutputFormat = "summary" | "detailed" | "enhanced";

// =============================================================================
// AST Parser Class
// =============================================================================

export class ASTParser {
  private ig: Ignore;
  private rootPath: string;

  constructor(rootPath: string, gitignorePath?: string) {
    this.rootPath = rootPath;
    this.ig = ignore();
    
    // Load .gitignore if exists
    const defaultGitignore = join(rootPath, ".gitignore");
    const gitignoreFile = gitignorePath || defaultGitignore;
    
    if (existsSync(gitignoreFile)) {
      try {
        const content = readFileSync(gitignoreFile, "utf-8");
        this.ig.add(content);
      } catch {
        // Ignore read errors
      }
    }
    
    // Always ignore common patterns
    this.ig.add([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      "coverage",
      "*.d.ts",
      "*.map",
      ".turbo",
      ".cache",
    ]);
  }

  /**
   * Parse files matching the given patterns
   */
  async parseFiles(
    patterns: string[],
    excludePatterns: string[] = []
  ): Promise<ASTSummary[]> {
    const results: ASTSummary[] = [];
    
    // Resolve glob patterns
    const allFiles: string[] = [];
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.rootPath,
        ignore: excludePatterns,
        nodir: true,
      });
      allFiles.push(...files);
    }
    
    // Deduplicate and filter
    const uniqueFiles = [...new Set(allFiles)];
    
    for (const file of uniqueFiles) {
      const relativePath = file.startsWith("/") ? relative(this.rootPath, file) : file;
      
      // Skip if ignored
      if (this.ig.ignores(relativePath)) {
        continue;
      }
      
      const fullPath = join(this.rootPath, relativePath);
      
      // Skip if not a file
      if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
        continue;
      }
      
      try {
        const content = readFileSync(fullPath, "utf-8");
        const summary = this.parseFile(relativePath, content);
        results.push(summary);
      } catch {
        // Skip unparseable files
      }
    }
    
    return results;
  }

  /**
   * Parse a single file
   */
  parseFile(relativePath: string, content: string): ASTSummary {
    const ext = extname(relativePath).toLowerCase();
    const fullPath = join(this.rootPath, relativePath);
    
    const baseSummary: ASTSummary = {
      file: fullPath,
      relativePath,
      language: "unknown",
      imports: [],
      classes: [],
      functions: [],
      interfaces: [],
      typeAliases: [],
      exports: [],
      dependencies: [],
    };
    
    if (ext === ".ts" || ext === ".tsx") {
      baseSummary.language = "typescript";
      return this.parseTypeScript(relativePath, content, baseSummary);
    } else if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
      baseSummary.language = "javascript";
      return this.parseTypeScript(relativePath, content, baseSummary); // TS parser handles JS too
    } else if (ext === ".json") {
      baseSummary.language = "json";
      return this.parseJSON(relativePath, content, baseSummary);
    }
    
    return baseSummary;
  }

  /**
   * Parse TypeScript/JavaScript file
   */
  private parseTypeScript(
    relativePath: string,
    content: string,
    summary: ASTSummary
  ): ASTSummary {
    const sourceFile = ts.createSourceFile(
      relativePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") || relativePath.endsWith(".jsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    );
    
    const visit = (node: ts.Node) => {
      // Import declarations
      if (ts.isImportDeclaration(node)) {
        this.parseImport(node, summary, relativePath);
      }
      
      // Class declarations
      else if (ts.isClassDeclaration(node)) {
        this.parseClass(node, summary);
      }
      
      // Function declarations
      else if (ts.isFunctionDeclaration(node)) {
        this.parseFunction(node, summary);
      }
      
      // Interface declarations
      else if (ts.isInterfaceDeclaration(node)) {
        this.parseInterface(node, summary);
      }
      
      // Type alias declarations
      else if (ts.isTypeAliasDeclaration(node)) {
        this.parseTypeAlias(node, summary);
      }
      
      // Export declarations
      else if (ts.isExportDeclaration(node)) {
        this.parseExportDeclaration(node, summary);
      }
      
      // Variable statements (for exported consts)
      else if (ts.isVariableStatement(node)) {
        this.parseVariableStatement(node, summary);
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    
    // Deduplicate dependencies
    summary.dependencies = [...new Set(summary.dependencies)];
    
    return summary;
  }

  /**
   * Parse import declaration
   */
  private parseImport(
    node: ts.ImportDeclaration,
    summary: ASTSummary,
    currentFile: string
  ): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) return;
    
    const source = moduleSpecifier.text;
    const importClause = node.importClause;
    
    // Resolve relative paths
    let resolvedPath: string | undefined;
    if (source.startsWith(".")) {
      const dir = dirname(currentFile);
      resolvedPath = this.resolveImportPath(join(dir, source));
    }
    
    // Add to dependencies
    summary.dependencies.push(resolvedPath || source);
    
    if (!importClause) {
      // Side-effect import: import "module"
      summary.imports.push({
        name: "*",
        source,
        resolvedPath,
        isDefault: false,
        isNamespace: false,
      });
      return;
    }
    
    // Default import
    if (importClause.name) {
      summary.imports.push({
        name: importClause.name.text,
        source,
        resolvedPath,
        isDefault: true,
        isNamespace: false,
      });
    }
    
    // Named imports
    const namedBindings = importClause.namedBindings;
    if (namedBindings) {
      if (ts.isNamespaceImport(namedBindings)) {
        summary.imports.push({
          name: namedBindings.name.text,
          source,
          resolvedPath,
          isDefault: false,
          isNamespace: true,
        });
      } else if (ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          summary.imports.push({
            name: element.name.text,
            source,
            resolvedPath,
            isDefault: false,
            isNamespace: false,
          });
        }
      }
    }
  }

  /**
   * Resolve import path to actual file
   */
  private resolveImportPath(importPath: string): string | undefined {
    const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ""];
    const indexFiles = ["index.ts", "index.tsx", "index.js", "index.jsx"];
    
    for (const ext of extensions) {
      const fullPath = join(this.rootPath, importPath + ext);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        return relative(this.rootPath, fullPath);
      }
    }
    
    // Try as directory with index file
    const dirPath = join(this.rootPath, importPath);
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      for (const indexFile of indexFiles) {
        const indexPath = join(dirPath, indexFile);
        if (existsSync(indexPath)) {
          return relative(this.rootPath, indexPath);
        }
      }
    }
    
    return undefined;
  }

  /**
   * Parse class declaration
   */
  private parseClass(node: ts.ClassDeclaration, summary: ASTSummary): void {
    if (!node.name) return;
    
    const classInfo: ClassInfo = {
      name: node.name.text,
      methods: [],
      properties: [],
      implements: [],
      isExported: this.hasExportModifier(node),
    };
    
    // Heritage (extends/implements)
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          classInfo.extends = clause.types[0]?.expression.getText();
        } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
          classInfo.implements = clause.types.map((t) => t.expression.getText());
        }
      }
    }
    
    // Members
    for (const member of node.members) {
      if (ts.isMethodDeclaration(member)) {
        classInfo.methods.push(this.parseMethodDeclaration(member));
      } else if (ts.isPropertyDeclaration(member)) {
        classInfo.properties.push(this.parsePropertyDeclaration(member));
      } else if (ts.isConstructorDeclaration(member)) {
        classInfo.methods.push(this.parseConstructor(member));
      }
    }
    
    summary.classes.push(classInfo);
    
    // Add to exports if exported
    if (classInfo.isExported) {
      summary.exports.push({
        name: classInfo.name,
        type: "class",
      });
    }
  }

  /**
   * Parse method declaration
   */
  private parseMethodDeclaration(node: ts.MethodDeclaration): MethodInfo {
    const name = node.name.getText();
    const parameters = this.parseParameters(node.parameters);
    const returnType = node.type?.getText() || "void";
    const isAsync = node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ) ?? false;
    
    return {
      name,
      signature: `(${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${returnType}`,
      parameters,
      returnType,
      visibility: this.getVisibility(node.modifiers),
      isStatic: this.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword),
      isAsync,
    };
  }

  /**
   * Parse constructor
   */
  private parseConstructor(node: ts.ConstructorDeclaration): MethodInfo {
    const parameters = this.parseParameters(node.parameters);
    
    return {
      name: "constructor",
      signature: `(${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")})`,
      parameters,
      returnType: "void",
      visibility: "public",
      isStatic: false,
      isAsync: false,
    };
  }

  /**
   * Parse property declaration
   */
  private parsePropertyDeclaration(node: ts.PropertyDeclaration): PropertyInfo {
    return {
      name: node.name.getText(),
      type: node.type?.getText() || "any",
      visibility: this.getVisibility(node.modifiers),
      isStatic: this.hasModifier(node.modifiers, ts.SyntaxKind.StaticKeyword),
      isReadonly: this.hasModifier(node.modifiers, ts.SyntaxKind.ReadonlyKeyword),
    };
  }

  /**
   * Parse function declaration
   */
  private parseFunction(node: ts.FunctionDeclaration, summary: ASTSummary): void {
    if (!node.name) return;
    
    const name = node.name.text;
    const parameters = this.parseParameters(node.parameters);
    const returnType = node.type?.getText() || "void";
    const isAsync = node.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword
    ) ?? false;
    const isExported = this.hasExportModifier(node);
    
    const funcInfo: FunctionInfo = {
      name,
      signature: `(${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${returnType}`,
      parameters,
      returnType,
      isAsync,
      isExported,
    };
    
    summary.functions.push(funcInfo);
    
    if (isExported) {
      summary.exports.push({
        name,
        type: "function",
      });
    }
  }

  /**
   * Parse interface declaration
   */
  private parseInterface(node: ts.InterfaceDeclaration, summary: ASTSummary): void {
    const interfaceInfo: InterfaceInfo = {
      name: node.name.text,
      properties: [],
      methods: [],
      extends: [],
      isExported: this.hasExportModifier(node),
    };
    
    // Heritage
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        interfaceInfo.extends = clause.types.map((t) => t.expression.getText());
      }
    }
    
    // Members
    for (const member of node.members) {
      if (ts.isPropertySignature(member)) {
        interfaceInfo.properties.push({
          name: member.name.getText(),
          type: member.type?.getText() || "any",
          visibility: "public",
          isStatic: false,
          isReadonly: this.hasModifier(member.modifiers, ts.SyntaxKind.ReadonlyKeyword),
        });
      } else if (ts.isMethodSignature(member)) {
        const parameters = this.parseParameters(member.parameters);
        const returnType = member.type?.getText() || "void";
        
        interfaceInfo.methods.push({
          name: member.name.getText(),
          signature: `(${parameters.map((p) => `${p.name}: ${p.type}`).join(", ")}): ${returnType}`,
          parameters,
          returnType,
          visibility: "public",
          isStatic: false,
          isAsync: false,
        });
      }
    }
    
    summary.interfaces.push(interfaceInfo);
    
    if (interfaceInfo.isExported) {
      summary.exports.push({
        name: interfaceInfo.name,
        type: "interface",
      });
    }
  }

  /**
   * Parse type alias declaration
   */
  private parseTypeAlias(node: ts.TypeAliasDeclaration, summary: ASTSummary): void {
    const isExported = this.hasExportModifier(node);
    
    summary.typeAliases.push({
      name: node.name.text,
      type: node.type.getText(),
      isExported,
    });
    
    if (isExported) {
      summary.exports.push({
        name: node.name.text,
        type: "type",
      });
    }
  }

  /**
   * Parse export declaration
   */
  private parseExportDeclaration(node: ts.ExportDeclaration, summary: ASTSummary): void {
    const moduleSpecifier = node.moduleSpecifier;
    
    if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
      // Re-export
      summary.exports.push({
        name: `* from "${moduleSpecifier.text}"`,
        type: "re-export",
      });
    }
  }

  /**
   * Parse variable statement
   */
  private parseVariableStatement(node: ts.VariableStatement, summary: ASTSummary): void {
    const isExported = this.hasExportModifier(node);
    
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        if (isExported) {
          summary.exports.push({
            name: declaration.name.text,
            type: "const",
          });
        }
      }
    }
  }

  /**
   * Parse parameters
   */
  private parseParameters(
    params: ts.NodeArray<ts.ParameterDeclaration>
  ): Array<{ name: string; type: string; optional: boolean }> {
    return params.map((param) => ({
      name: param.name.getText(),
      type: param.type?.getText() || "any",
      optional: !!param.questionToken || !!param.initializer,
    }));
  }

  /**
   * Get visibility modifier
   */
  private getVisibility(
    modifiers: ts.NodeArray<ts.ModifierLike> | undefined
  ): "public" | "private" | "protected" {
    if (!modifiers) return "public";
    
    for (const mod of modifiers) {
      if (mod.kind === ts.SyntaxKind.PrivateKeyword) return "private";
      if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return "protected";
    }
    
    return "public";
  }

  /**
   * Check if node has export modifier
   */
  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return this.hasModifier(modifiers, ts.SyntaxKind.ExportKeyword);
  }

  /**
   * Check if node has a specific modifier
   */
  private hasModifier(
    modifiers: ts.NodeArray<ts.ModifierLike> | readonly ts.Modifier[] | undefined,
    kind: ts.SyntaxKind
  ): boolean {
    if (!modifiers) return false;
    return modifiers.some((m) => m.kind === kind);
  }

  /**
   * Parse JSON file (package.json, tsconfig.json, etc.)
   */
  private parseJSON(
    _relativePath: string,
    content: string,
    summary: ASTSummary
  ): ASTSummary {
    try {
      const json = JSON.parse(content);
      
      // Extract dependencies from package.json
      if (json.dependencies) {
        summary.dependencies.push(...Object.keys(json.dependencies));
      }
      if (json.devDependencies) {
        summary.dependencies.push(...Object.keys(json.devDependencies));
      }
      
      // Add main export info
      if (json.main || json.module || json.exports) {
        summary.exports.push({
          name: json.name || "package",
          type: "default",
          description: json.description,
        });
      }
    } catch {
      // Invalid JSON
    }
    
    return summary;
  }
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format AST summary for output
 */
export function formatASTSummary(
  summary: ASTSummary,
  format: OutputFormat
): string {
  const lines: string[] = [];
  
  lines.push(`File: ${summary.relativePath}`);
  lines.push("");
  
  // Imports
  if (summary.imports.length > 0) {
    lines.push("Imports:");
    for (const imp of summary.imports) {
      if (format === "enhanced" && imp.resolvedPath) {
        lines.push(`- ${imp.name} -> ${imp.resolvedPath}`);
      } else {
        const qualifier = imp.isDefault ? "(default) " : imp.isNamespace ? "(namespace) " : "";
        lines.push(`- ${qualifier}${imp.name} from "${imp.source}"`);
      }
    }
    lines.push("");
  }
  
  // Classes
  if (summary.classes.length > 0) {
    lines.push("Classes:");
    for (const cls of summary.classes) {
      let classLine = `- ${cls.name}`;
      if (cls.extends) classLine += ` extends ${cls.extends}`;
      if (cls.implements.length > 0) classLine += ` implements ${cls.implements.join(", ")}`;
      if (format === "enhanced") classLine += " -> <we will put details here>";
      lines.push(classLine);
      
      if (format !== "summary") {
        if (cls.methods.length > 0) {
          lines.push("  Methods:");
          for (const method of cls.methods) {
            let methodLine = `    - ${method.name}${method.signature}`;
            if (format === "enhanced") methodLine += " -> <we will put details here>";
            lines.push(methodLine);
          }
        }
        if (cls.properties.length > 0 && format === "detailed") {
          lines.push("  Properties:");
          for (const prop of cls.properties) {
            lines.push(`    - ${prop.name}: ${prop.type}`);
          }
        }
      }
    }
    lines.push("");
  }
  
  // Functions
  if (summary.functions.length > 0) {
    lines.push("Functions:");
    for (const func of summary.functions) {
      let funcLine = `- ${func.name}${func.signature}`;
      if (func.isAsync) funcLine += " [async]";
      if (format === "enhanced") funcLine += " -> <we will put details here>";
      lines.push(funcLine);
    }
    lines.push("");
  }
  
  // Interfaces (detailed/enhanced only)
  if (format !== "summary" && summary.interfaces.length > 0) {
    lines.push("Interfaces:");
    for (const iface of summary.interfaces) {
      let ifaceLine = `- ${iface.name}`;
      if (iface.extends.length > 0) ifaceLine += ` extends ${iface.extends.join(", ")}`;
      lines.push(ifaceLine);
      
      if (format === "detailed" && iface.properties.length > 0) {
        for (const prop of iface.properties) {
          lines.push(`    ${prop.name}: ${prop.type}`);
        }
      }
    }
    lines.push("");
  }
  
  // Type Aliases (detailed/enhanced only)
  if (format !== "summary" && summary.typeAliases.length > 0) {
    lines.push("Types:");
    for (const type of summary.typeAliases) {
      lines.push(`- ${type.name} = ${type.type}`);
    }
    lines.push("");
  }
  
  // Exports
  if (summary.exports.length > 0) {
    lines.push("Exports:");
    for (const exp of summary.exports) {
      let expLine = `- ${exp.name} (${exp.type})`;
      if (format === "enhanced") expLine += " -> <we will put details here>";
      lines.push(expLine);
    }
    lines.push("");
  }
  
  // Dependencies (summary only shows count)
  if (format === "summary" && summary.dependencies.length > 0) {
    lines.push(`Dependencies: ${summary.dependencies.length} modules`);
  } else if (format !== "summary" && summary.dependencies.length > 0) {
    lines.push("Dependencies:");
    for (const dep of summary.dependencies) {
      lines.push(`- ${dep}`);
    }
  }
  
  return lines.join("\n");
}

/**
 * Format multiple AST summaries
 */
export function formatASTSummaries(
  summaries: ASTSummary[],
  format: OutputFormat
): string {
  return summaries
    .map((s) => formatASTSummary(s, format))
    .join("\n\n---\n\n");
}

/**
 * Generate markdown table for technical details
 */
export function generateTechnicalDetailsMarkdown(summary: ASTSummary): string {
  const lines: string[] = [];
  
  lines.push(`# Technical Details: ${summary.relativePath}`);
  lines.push("");
  
  // File metadata
  lines.push("## File Metadata");
  lines.push(`- Path: ${summary.relativePath}`);
  lines.push(`- Language: ${summary.language}`);
  lines.push("");
  
  // Imports table
  if (summary.imports.length > 0) {
    lines.push("## Imports");
    lines.push("| Import | Source | Resolved Path |");
    lines.push("|--------|--------|---------------|");
    for (const imp of summary.imports) {
      lines.push(`| ${imp.name} | ${imp.source} | ${imp.resolvedPath || "external"} |`);
    }
    lines.push("");
  }
  
  // Classes
  for (const cls of summary.classes) {
    lines.push(`## Class: ${cls.name}`);
    if (cls.extends) lines.push(`Extends: ${cls.extends}`);
    if (cls.implements.length > 0) lines.push(`Implements: ${cls.implements.join(", ")}`);
    lines.push("");
    
    if (cls.methods.length > 0) {
      lines.push("**Methods:**");
      lines.push("");
      lines.push("| Method | Signature | Description |");
      lines.push("|--------|-----------|-------------|");
      for (const method of cls.methods) {
        const visibility = method.visibility !== "public" ? `[${method.visibility}] ` : "";
        const async = method.isAsync ? "[async] " : "";
        lines.push(`| ${visibility}${async}${method.name} | ${method.signature} | ${method.description || "<description>"} |`);
      }
      lines.push("");
    }
    
    if (cls.properties.length > 0) {
      lines.push("**Properties:**");
      lines.push("");
      lines.push("| Property | Type | Visibility |");
      lines.push("|----------|------|------------|");
      for (const prop of cls.properties) {
        lines.push(`| ${prop.name} | ${prop.type} | ${prop.visibility} |`);
      }
      lines.push("");
    }
  }
  
  // Exports
  if (summary.exports.length > 0) {
    lines.push("## Exports");
    lines.push("| Export | Type | Description |");
    lines.push("|--------|------|-------------|");
    for (const exp of summary.exports) {
      lines.push(`| ${exp.name} | ${exp.type} | ${exp.description || "<description>"} |`);
    }
    lines.push("");
  }
  
  // Dependencies
  if (summary.dependencies.length > 0) {
    lines.push("## Dependencies");
    for (const dep of summary.dependencies) {
      lines.push(`- ${dep}`);
    }
  }
  
  return lines.join("\n");
}
