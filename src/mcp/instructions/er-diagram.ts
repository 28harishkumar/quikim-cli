/**
 * ER Diagram Instructions
 * Instructions for creating/updating ER diagrams
 */

export interface ERDiagramContext {
  projectName: string;
  quikimFeatures?: Array<{
    name: string;
    description: string;
    databaseSchema?: {
      entities?: Array<{
        name: string;
        columns?: Array<{ name: string; type: string; required?: boolean }>;
      }>;
      relationships?: Array<{ from: string; to: string; type: string }>;
      columns?: Array<{
        entity: string;
        name: string;
        type: string;
        required?: boolean;
      }>;
      indexes?: Array<{ entity: string; columns: string[] }>;
    };
  }>;
}

export function generateERDiagramInstructions(
  context: ERDiagramContext
): string {
  const { projectName, quikimFeatures } = context;

  let instructions = `Generate an ER (Entity-Relationship) diagram for the ${projectName} project in Mermaid format.

**The ER diagram should include:**

${
  quikimFeatures && quikimFeatures.length > 0
    ? `**Quikim Dashboard Features:**
${quikimFeatures
  .map((feature) => {
    let featureInfo = `- ${feature.name}: ${feature.description}`;

    if (feature.databaseSchema) {
      const schema = feature.databaseSchema;

      // Add entities with columns
      if (schema.entities && schema.entities.length > 0) {
        featureInfo += `\n  **Entities:**`;
        schema.entities.forEach((entity) => {
          featureInfo += `\n    - ${entity.name}`;
          if (entity.columns && entity.columns.length > 0) {
            featureInfo += `\n      Columns: ${entity.columns
              .map(
                (c) => `${c.name} (${c.type}${c.required ? ", required" : ""})`
              )
              .join(", ")}`;
          }
        });
      }

      // Add relationships
      if (schema.relationships && schema.relationships.length > 0) {
        featureInfo += `\n  **Relationships:**`;
        schema.relationships.forEach((rel) => {
          featureInfo += `\n    - ${rel.from} ${rel.type} ${rel.to}`;
        });
      }

      // Add indexes
      if (schema.indexes && schema.indexes.length > 0) {
        featureInfo += `\n  **Indexes:**`;
        schema.indexes.forEach((idx) => {
          featureInfo += `\n    - ${idx.entity}(${idx.columns.join(", ")})`;
        });
      }
    }

    return featureInfo;
  })
  .join("\n\n")}

**Complete the ER diagram by:**
- Adding all entities from Quikim features above with their columns
- Defining relationships between all entities as specified
- Including all necessary fields for each entity
- Adding constraints and indexes where appropriate
- Note: Some columns may be missing or extra in Quikim database structure - adjust based on project requirements

`
    : ""
}**Additional Entities from Requirements:**
- Analyze the requirements document to identify any additional data entities not covered by Quikim features
- Define relationships between all entities (one-to-one, one-to-many, many-to-many)
- Include all necessary fields for each entity
- Add constraints and indexes where appropriate

**ER Diagram Format:**
Use Mermaid erDiagram syntax:
\`\`\`mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        string id PK
        string email
        string name
    }
\`\`\`

**Save to:** Appropriate version directory (e.g., .quikim/v1/er-diagram.md) in Mermaid format.

**Next Steps:** After creating ER diagram, proceed to Prisma schema generation or task creation.`;

  return instructions;
}
