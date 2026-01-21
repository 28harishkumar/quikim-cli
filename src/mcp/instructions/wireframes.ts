/**
 * Wireframes Instructions
 * Instructions for creating/updating wireframes
 */

export interface WireframeContext {
  projectName: string;
  components: {
    websites: number;
    portals: number;
    mobileApps: number;
  };
}

export function generateWireframeInstructions(
  context: WireframeContext
): string {
  const { projectName, components } = context;

  const componentsList = [
    components.websites > 0 ? `- ${components.websites} website(s)` : "",
    components.portals > 0 ? `- ${components.portals} portal(s)/dashboard(s)` : "",
    components.mobileApps > 0 ? `- ${components.mobileApps} mobile app(s)` : "",
  ].filter(Boolean).join("\n");

  return `Generate wireframes for the ${projectName} project based on the requirements.

**Components to Design:**
${componentsList}

**Wireframe Workflow:**
1. Create wireframe descriptions in .quikim/v*/wireframes.md
2. Use push_wireframes to sync to Quikim database (versioned)
3. MCP server syncs to Penpot via tools-service
4. Edit wireframes in Penpot UI if needed
5. During code generation, Penpot designs convert to React components

**Wireframe Content Format:**
- Component hierarchy (components → widgets → pages)
- Layout structure (header, sidebar, main content, footer)
- Navigation elements (menus, breadcrumbs, tabs)
- UI components (forms, buttons, cards, tables, modals)
- Interaction flows (page transitions, user journeys)
- Responsive breakpoints (mobile, tablet, desktop)
- Design tokens (colors, typography, spacing)
- Animations and transitions

**Component Structure:**
- Components: Small reusable UI elements (buttons, inputs, cards)
- Widgets: Composed components (forms, nav bars, data tables)
- Pages: Full page layouts with multiple widgets
- Themes: Design tokens and styling system
- Actions: User interactions and navigation flows

**Save to:** .quikim/v1/wireframes.md

**Next Steps:** After wireframes, proceed to ER diagram using er_diagram_pull tool.`;
}
