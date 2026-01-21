/**
 * Prisma Schema Instructions
 * Instructions for creating/updating Prisma schemas
 */

export interface PrismaSchemaContext {
  projectName: string;
  databaseType: string;
  projectStructure?: {
    rootPath: string;
    hasPrisma?: boolean;
    prismaPath?: string;
  };
}

export function generatePrismaSchemaInstructions(
  context: PrismaSchemaContext
): string {
  const { projectName, databaseType, projectStructure } = context;

  // Determine Prisma schema location from project structure
  let schemaPath = "prisma/schema.prisma";
  if (projectStructure?.prismaPath) {
    schemaPath = projectStructure.prismaPath;
  } else if (projectStructure?.hasPrisma) {
    // Check if prisma directory exists in project structure
    schemaPath = "prisma/schema.prisma";
  }

  return `Generate a Prisma schema file from the ER diagram for the ${projectName} project.

**Requirements:**
1. Convert all entities from the ER diagram to Prisma models
2. Implement all relationships (one-to-one, one-to-many, many-to-many)
3. Include all fields with correct data types
4. Add appropriate indexes for performance
5. Include constraints (unique, required, default values)
6. Add timestamps (createdAt, updatedAt) to all models
7. Use datasource provider: ${databaseType}

**Prisma Schema Location:**
Save to: ${schemaPath}

**Next Steps:** After creating Prisma schema, run \`npx prisma generate\` to generate Prisma Client.`;
}
