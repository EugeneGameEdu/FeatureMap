import { SUPPORTED_VERSIONS } from '../constants/versions.js';

export interface ContextTemplateDefinition {
  key: 'decisions' | 'constraints' | 'overview' | 'design-system';
  filename: string;
  label: string;
  content: string;
}

export function buildContextTemplates(now: string): ContextTemplateDefinition[] {
  const version = SUPPORTED_VERSIONS.context;

  return [
    {
      key: 'decisions',
      filename: 'decisions.yaml',
      label: 'decisions.yaml',
      content: [
        '# Project decisions tracked for humans and AI.',
        '# Keep entries stable; update status when superseded.',
        `version: ${version}`,
        'source: manual',
        `updatedAt: "${now}"`,
        '',
        'decisions:',
        '  # - id: use-react',
        '  #   title: "Use React for frontend"',
        '  #   description: "Chose React as the primary frontend framework."',
        '  #   rationale: "Team expertise, ecosystem, hiring pool."',
        '  #   date: "2024-01-01"',
        '  #   status: active',
        '  []',
      ].join('\n'),
    },
    {
      key: 'constraints',
      filename: 'constraints.yaml',
      label: 'constraints.yaml',
      content: [
        '# Project constraints that shape architecture decisions.',
        '# Use one constraint per entry.',
        `version: ${version}`,
        'source: manual',
        `updatedAt: "${now}"`,
        '',
        'constraints:',
        '  # - id: avoid-ssr',
        '  #   type: technical',
        '  #   title: "Client-only rendering"',
        '  #   description: "The app must run without server-side rendering."',
        '  #   impact: "All pages must be compatible with static hosting."',
        '  []',
      ].join('\n'),
    },
    {
      key: 'overview',
      filename: 'overview.yaml',
      label: 'overview.yaml',
      content: [
        '# High-level overview used by AI and humans.',
        '# Keep this short and business-friendly.',
        `version: ${version}`,
        'source: manual',
        `updatedAt: "${now}"`,
        '',
        'summary: "Short summary of what this project does."',
        'purpose: "Why this project exists."',
        '# architecture: "Optional high-level architecture notes."',
        '# keyFeatures:',
        '#   - "Feature A"',
        '#   - "Feature B"',
        'keyFeatures: []',
        '# targetUsers:',
        '#   - "Internal developers"',
        '#   - "Customers"',
        'targetUsers: []',
      ].join('\n'),
    },
    {
      key: 'design-system',
      filename: 'design-system.yaml',
      label: 'design-system.yaml',
      content: [
        '# Design system guidance for UI consistency.',
        '# Used by AI and humans to align visuals.',
        `version: ${version}`,
        'source: manual',
        `updatedAt: "${now}"`,
        '',
        '# designPrinciples:',
        '#   - "Accessible by default"',
        '#   - "High contrast"',
        'designPrinciples: []',
        '# colors:',
        '#   primary: "#1f2937"',
        '#   accent: "#f97316"',
        'colors: {}',
        '# typography:',
        '#   fonts: "Source Serif Pro, Arial"',
        '#   scale: "1.125"',
        'typography: {}',
        '# components:',
        '#   buttons: "Rounded corners, high contrast"',
        'components: {}',
      ].join('\n'),
    },
  ];
}
