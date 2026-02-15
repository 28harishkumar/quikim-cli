/**
 * Quikim - AST Parser Service
 *
 * Parses existing codebases into AST-like summaries for efficient context generation.
 * Supports TypeScript, JavaScript, React, and common project structures.
 *
 * Copyright (c) 2026 Quikim Pvt. Ltd.
 *
 * This file is part of Quikim, licensed under the AGPL-3.0 License.
 * See LICENSE file in the project root for full license information.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname, relative } from "path";

export interface ASTFunction {
  name: string;
  params: string[];
  returnType?: string;
  async: boolean;
  exported: boolean;
  line: number;
}

export interface ASTClass {
  name: string;
  extends?: string;
  implements?: string[];
  methods: ASTFunction[];
  properties: Array<{ name: string; type?: string; visibility?: string }>;
  exported: boolean;
  line: number;
}

export interface ASTInterface {
  name: string;
  extends?: string[];
  properties: Array<{ name: string; type: string; optional: boolean }>;
  exported: boolean;
  line: number;
}

export interface ASTType {
  name: string;
  definition: string;
  exported: boolean;
  line: number;
}

export interface ASTImport {
  module: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ASTExport {
  name: string;
  type: "function" | "class" | "interface" | "type" | "const" | "default";
}

export interface FileAST {
  path: string;
  imports: ASTImport[];
  exports: ASTExport[];
  functions: ASTFunction[];
  classes: ASTClass[];
  interfaces: ASTInterface[];
  types: ASTType[];
  reactComponents?: string[];
  summary: string;
}

export interface ProjectAST {
  rootPath: string;
  files: FileAST[];
  structure: ProjectStructure;
  summary: string;
}

export interface ProjectStructure {
  directories: string[];
  entryPoints: string[];
  configFiles: string[];
  packageJson?: {
    name: string;
    dependencies: string[];
    devDependencies: string[];
    scripts: string[];
  };
}

export interface ASTParseOptions {
  maxDepth?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
  summaryOnly?: boolean;
}

const DEFAULT_OPTIONS: Required<ASTParseOptions> = {
  maxDepth: 10,
  includePatterns: [".ts", ".tsx", ".js", ".jsx"],
  excludePatterns: [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    "coverage",
    "__tests__",
    "*.test.*",
    "*.spec.*",
  ],
  maxFiles: 500,
  summaryOnly: false,
};

/**
 * AST Parser for codebase analysis
 */
export class ASTParser {
  private options: Required<ASTParseOptions>;

  constructor(options: ASTParseOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Parse an entire codebase directory
   */
  async parseCodebase(rootPath: string): Promise<ProjectAST> {
    const files: FileAST[] = [];
    const structure = this.analyzeStructure(rootPath);

    // Collect all parseable files
    const filePaths = this.collectFiles(rootPath, 0);

    // Parse each file
    for (const filePath of filePaths.slice(0, this.options.maxFiles)) {
      try {
        const fileAST = await this.parseFile(filePath, rootPath);
        if (fileAST) {
          files.push(fileAST);
        }
      } catch {
        // Skip unparseable files
      }
    }

    const summary = this.generateProjectSummary(files, structure);

    return {
      rootPath,
      files,
      structure,
      summary,
    };
  }

  /**
   * Parse a single file into AST summary
   */
  async parseFile(filePath: string, rootPath?: string): Promise<FileAST | null> {
    if (!existsSync(filePath)) return null;

    const content = readFileSync(filePath, "utf-8");
    const ext = extname(filePath);
    const relativePath = rootPath ? relative(rootPath, filePath) : filePath;

    const imports = this.parseImports(content);
    const exports = this.parseExports(content);
    const functions = this.parseFunctions(content);
    const classes = this.parseClasses(content);
    const interfaces = this.parseInterfaces(content);
    const types = this.parseTypes(content);
    const reactComponents =
      ext === ".tsx" || ext === ".jsx"
        ? this.parseReactComponents(content)
        : undefined;

    const summary = this.generateFileSummary({
      path: relativePath,
      imports,
      exports,
      functions,
      classes,
      interfaces,
      types,
      reactComponents,
      summary: "",
    });

    return {
      path: relativePath,
      imports,
      exports,
      functions,
      classes,
      interfaces,
      types,
      reactComponents,
      summary,
    };
  }

  /**
   * Analyze project structure
   */
  private analyzeStructure(rootPath: string): ProjectStructure {
    const directories: string[] = [];
    const entryPoints: string[] = [];
    const configFiles: string[] = [];
    let packageJson: ProjectStructure["packageJson"];

    // Read package.json if exists
    const pkgPath = join(rootPath, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        packageJson = {
          name: pkg.name || "unknown",
          dependencies: Object.keys(pkg.dependencies || {}),
          devDependencies: Object.keys(pkg.devDependencies || {}),
          scripts: Object.keys(pkg.scripts || {}),
        };
        configFiles.push("package.json");
      } catch {
        // Skip malformed package.json
      }
    }

    // Find common config files
    const configPatterns = [
      "tsconfig.json",
      "next.config.js",
      "next.config.mjs",
      "vite.config.ts",
      "webpack.config.js",
      ".eslintrc.js",
      ".prettierrc",
      "tailwind.config.js",
      "postcss.config.js",
    ];

    for (const pattern of configPatterns) {
      if (existsSync(join(rootPath, pattern))) {
        configFiles.push(pattern);
      }
    }

    // Find entry points
    const entryPatterns = [
      "src/index.ts",
      "src/index.tsx",
      "src/main.ts",
      "src/main.tsx",
      "src/app.ts",
      "src/app.tsx",
      "pages/_app.tsx",
      "app/layout.tsx",
      "index.ts",
      "index.js",
    ];

    for (const pattern of entryPatterns) {
      if (existsSync(join(rootPath, pattern))) {
        entryPoints.push(pattern);
      }
    }

    // Find top-level directories
    try {
      const items = readdirSync(rootPath);
      for (const item of items) {
        const itemPath = join(rootPath, item);
        if (
          statSync(itemPath).isDirectory() &&
          !this.shouldExclude(item)
        ) {
          directories.push(item);
        }
      }
    } catch {
      // Skip if cannot read directory
    }

    return {
      directories,
      entryPoints,
      configFiles,
      packageJson,
    };
  }

  /**
   * Collect all files to parse
   */
  private collectFiles(dirPath: string, depth: number): string[] {
    if (depth > this.options.maxDepth) return [];

    const files: string[] = [];

    try {
      const items = readdirSync(dirPath);

      for (const item of items) {
        if (this.shouldExclude(item)) continue;

        const itemPath = join(dirPath, item);
        const stat = statSync(itemPath);

        if (stat.isDirectory()) {
          files.push(...this.collectFiles(itemPath, depth + 1));
        } else if (this.shouldInclude(item)) {
          files.push(itemPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return files;
  }

  /**
   * Parse import statements
   */
  private parseImports(content: string): ASTImport[] {
    const imports: ASTImport[] = [];
    const importRegex =
      /import\s+(?:(\*\s+as\s+(\w+))|(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?)?\s*from\s*['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const [, namespace, namespaceAlias, defaultImport, namedImports, module] =
        match;

      const importedNames: string[] = [];
      let isDefault = false;
      let isNamespace = false;

      if (namespace) {
        isNamespace = true;
        importedNames.push(namespaceAlias);
      }
      if (defaultImport) {
        isDefault = true;
        importedNames.push(defaultImport);
      }
      if (namedImports) {
        const names = namedImports.split(",").map((n) => n.trim().split(/\s+as\s+/)[0]);
        importedNames.push(...names);
      }

      imports.push({
        module,
        imports: importedNames,
        isDefault,
        isNamespace,
      });
    }

    return imports;
  }

  /**
   * Parse export statements
   */
  private parseExports(content: string): ASTExport[] {
    const exports: ASTExport[] = [];

    // Named exports
    const namedExportRegex =
      /export\s+(async\s+)?(function|class|interface|type|const|let|var)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      const [, , type, name] = match;
      exports.push({
        name,
        type: type as ASTExport["type"],
      });
    }

    // Default export
    if (/export\s+default\s+/.test(content)) {
      const defaultMatch = content.match(
        /export\s+default\s+(?:class|function)?\s*(\w+)?/
      );
      exports.push({
        name: defaultMatch?.[1] || "default",
        type: "default",
      });
    }

    return exports;
  }

  /**
   * Parse function declarations
   */
  private parseFunctions(content: string): ASTFunction[] {
    const functions: ASTFunction[] = [];

    // Match function declarations and arrow functions
    const funcRegex =
      /^(export\s+)?(async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/gm;

    const arrowRegex =
      /^(export\s+)?(const|let|var)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(async\s*)?\(?([^)=]*)\)?\s*(?::\s*([^=]+))?\s*=>/gm;

    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const [, exported, async_, name, params, returnType] = match;
      const line = content.substring(0, match.index).split("\n").length;

      functions.push({
        name,
        params: params
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        returnType: returnType?.trim(),
        async: !!async_,
        exported: !!exported,
        line,
      });
    }

    while ((match = arrowRegex.exec(content)) !== null) {
      const [, exported, , name, async_, params, returnType] = match;
      const line = content.substring(0, match.index).split("\n").length;

      functions.push({
        name,
        params: params
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        returnType: returnType?.trim(),
        async: !!async_,
        exported: !!exported,
        line,
      });
    }

    return functions;
  }

  /**
   * Parse class declarations
   */
  private parseClasses(content: string): ASTClass[] {
    const classes: ASTClass[] = [];

    const classRegex =
      /^(export\s+)?(abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+)(?:<[^>]+>)?)?(?:\s+implements\s+([^{]+))?\s*\{/gm;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const [, exported, , name, extendsClass, implementsStr] = match;
      const line = content.substring(0, match.index).split("\n").length;

      // Find class body (simplified - counts braces)
      const startIdx = match.index + match[0].length - 1;
      let braceCount = 1;
      let endIdx = startIdx + 1;
      while (braceCount > 0 && endIdx < content.length) {
        if (content[endIdx] === "{") braceCount++;
        if (content[endIdx] === "}") braceCount--;
        endIdx++;
      }

      const classBody = content.substring(startIdx, endIdx);

      classes.push({
        name,
        extends: extendsClass,
        implements: implementsStr
          ?.split(",")
          .map((i) => i.trim())
          .filter(Boolean),
        methods: this.parseClassMethods(classBody),
        properties: this.parseClassProperties(classBody),
        exported: !!exported,
        line,
      });
    }

    return classes;
  }

  /**
   * Parse class methods
   */
  private parseClassMethods(classBody: string): ASTFunction[] {
    const methods: ASTFunction[] = [];

    const methodRegex =
      /(public|private|protected)?\s*(static)?\s*(async)?\s*(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;

    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const [, , , async_, name, params, returnType] = match;

      // Skip constructor-like patterns that aren't methods
      if (name === "constructor" || name === "if" || name === "for" || name === "while") continue;

      methods.push({
        name,
        params: params
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        returnType: returnType?.trim(),
        async: !!async_,
        exported: false,
        line: 0,
      });
    }

    return methods;
  }

  /**
   * Parse class properties
   */
  private parseClassProperties(
    classBody: string
  ): Array<{ name: string; type?: string; visibility?: string }> {
    const properties: Array<{ name: string; type?: string; visibility?: string }> = [];

    const propRegex =
      /(public|private|protected)?\s*(readonly)?\s*(\w+)(?:\s*:\s*([^;=]+))?(?:\s*=)?/g;

    let match;
    while ((match = propRegex.exec(classBody)) !== null) {
      const [, visibility, , name, type] = match;

      // Skip method-like patterns
      if (name === "constructor" || name === "async" || name === "static") continue;

      properties.push({
        name,
        type: type?.trim(),
        visibility,
      });
    }

    return properties.slice(0, 20); // Limit to 20 properties
  }

  /**
   * Parse interface declarations
   */
  private parseInterfaces(content: string): ASTInterface[] {
    const interfaces: ASTInterface[] = [];

    const interfaceRegex =
      /^(export\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^{]+))?\s*\{/gm;

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const [, exported, name, extendsStr] = match;
      const line = content.substring(0, match.index).split("\n").length;

      // Find interface body
      const startIdx = match.index + match[0].length - 1;
      let braceCount = 1;
      let endIdx = startIdx + 1;
      while (braceCount > 0 && endIdx < content.length) {
        if (content[endIdx] === "{") braceCount++;
        if (content[endIdx] === "}") braceCount--;
        endIdx++;
      }

      const interfaceBody = content.substring(startIdx + 1, endIdx - 1);
      const properties = this.parseInterfaceProperties(interfaceBody);

      interfaces.push({
        name,
        extends: extendsStr
          ?.split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        properties,
        exported: !!exported,
        line,
      });
    }

    return interfaces;
  }

  /**
   * Parse interface properties
   */
  private parseInterfaceProperties(
    body: string
  ): Array<{ name: string; type: string; optional: boolean }> {
    const properties: Array<{ name: string; type: string; optional: boolean }> = [];

    const propRegex = /(\w+)(\?)?:\s*([^;,\n]+)/g;

    let match;
    while ((match = propRegex.exec(body)) !== null) {
      const [, name, optional, type] = match;

      properties.push({
        name,
        type: type.trim(),
        optional: !!optional,
      });
    }

    return properties.slice(0, 30); // Limit to 30 properties
  }

  /**
   * Parse type aliases
   */
  private parseTypes(content: string): ASTType[] {
    const types: ASTType[] = [];

    const typeRegex = /^(export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/gm;

    let match;
    while ((match = typeRegex.exec(content)) !== null) {
      const [, exported, name, definition] = match;
      const line = content.substring(0, match.index).split("\n").length;

      types.push({
        name,
        definition: definition.trim().substring(0, 200), // Truncate long definitions
        exported: !!exported,
        line,
      });
    }

    return types;
  }

  /**
   * Parse React components
   */
  private parseReactComponents(content: string): string[] {
    const components: string[] = [];

    // Function components
    const funcComponentRegex =
      /(?:export\s+)?(?:const|function)\s+(\w+)\s*(?:<[^>]*>)?\s*(?:=\s*)?(?:\([^)]*\)|[^=]*)\s*(?:=>|:)\s*(?:JSX\.Element|React\.(?:FC|ReactNode)|ReactElement|\{)/g;

    let match;
    while ((match = funcComponentRegex.exec(content)) !== null) {
      const [, name] = match;
      if (name && /^[A-Z]/.test(name)) {
        components.push(name);
      }
    }

    // Class components
    const classComponentRegex =
      /class\s+(\w+)\s+extends\s+(?:React\.)?(?:Component|PureComponent)/g;

    while ((match = classComponentRegex.exec(content)) !== null) {
      const [, name] = match;
      if (name) {
        components.push(name);
      }
    }

    return [...new Set(components)];
  }

  /**
   * Generate file summary
   */
  private generateFileSummary(file: FileAST): string {
    const parts: string[] = [];

    parts.push(`// ${file.path}`);

    if (file.imports.length > 0) {
      const deps = file.imports.map((i) => i.module).slice(0, 5);
      parts.push(`// Imports: ${deps.join(", ")}${file.imports.length > 5 ? "..." : ""}`);
    }

    if (file.exports.length > 0) {
      parts.push(`// Exports: ${file.exports.map((e) => e.name).join(", ")}`);
    }

    if (file.reactComponents && file.reactComponents.length > 0) {
      parts.push(`// React Components: ${file.reactComponents.join(", ")}`);
    }

    if (file.classes.length > 0) {
      for (const cls of file.classes) {
        parts.push(`class ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ""} { -> <${cls.methods.length} methods, ${cls.properties.length} props> }`);
      }
    }

    if (file.interfaces.length > 0) {
      for (const iface of file.interfaces) {
        parts.push(`interface ${iface.name} { -> <${iface.properties.length} properties> }`);
      }
    }

    if (file.functions.length > 0) {
      for (const func of file.functions.slice(0, 10)) {
        const prefix = func.exported ? "export " : "";
        const asyncPrefix = func.async ? "async " : "";
        parts.push(`${prefix}${asyncPrefix}function ${func.name}(${func.params.length > 0 ? "..." : ""})${func.returnType ? `: ${func.returnType}` : ""}`);
      }
    }

    return parts.join("\n");
  }

  /**
   * Generate project summary
   */
  private generateProjectSummary(files: FileAST[], structure: ProjectStructure): string {
    const parts: string[] = [];

    parts.push("# Project AST Summary\n");

    if (structure.packageJson) {
      parts.push(`## Package: ${structure.packageJson.name}`);
      parts.push(`- Dependencies: ${structure.packageJson.dependencies.slice(0, 10).join(", ")}${structure.packageJson.dependencies.length > 10 ? "..." : ""}`);
      parts.push(`- Scripts: ${structure.packageJson.scripts.join(", ")}`);
      parts.push("");
    }

    parts.push(`## Structure`);
    parts.push(`- Directories: ${structure.directories.join(", ")}`);
    parts.push(`- Entry points: ${structure.entryPoints.join(", ")}`);
    parts.push(`- Config files: ${structure.configFiles.join(", ")}`);
    parts.push("");

    parts.push(`## Files Analyzed: ${files.length}`);
    parts.push("");

    // Group by directory
    const byDir = new Map<string, FileAST[]>();
    for (const file of files) {
      const dir = file.path.includes("/")
        ? file.path.substring(0, file.path.lastIndexOf("/"))
        : ".";
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir)!.push(file);
    }

    for (const [dir, dirFiles] of byDir) {
      parts.push(`### ${dir}/`);
      for (const file of dirFiles.slice(0, 20)) {
        parts.push(file.summary);
        parts.push("");
      }
    }

    return parts.join("\n");
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(name: string): boolean {
    return this.options.excludePatterns.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        return regex.test(name);
      }
      return name === pattern || name.startsWith(pattern);
    });
  }

  /**
   * Check if file should be included
   */
  private shouldInclude(name: string): boolean {
    const ext = extname(name);
    return this.options.includePatterns.includes(ext);
  }
}

/**
 * Quick parse function for single file
 */
export async function parseFile(filePath: string): Promise<FileAST | null> {
  const parser = new ASTParser();
  return parser.parseFile(filePath);
}

/**
 * Quick parse function for codebase
 */
export async function parseCodebase(
  rootPath: string,
  options?: ASTParseOptions
): Promise<ProjectAST> {
  const parser = new ASTParser(options);
  return parser.parseCodebase(rootPath);
}

export default ASTParser;
