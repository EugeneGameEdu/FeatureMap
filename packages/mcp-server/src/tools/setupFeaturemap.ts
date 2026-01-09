import * as path from 'path';
import { z } from 'zod';
import {
  scanProjectStructure,
} from '@featuremap/cli/dist/analyzer/structure-scanner.js';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import {
  analyzeStructureForSetup,
} from '../utils/setupFeaturemapAnalysis.js';
import { checkProjectState } from '../utils/setupFeaturemapState.js';

export const setupFeaturemapTool = {
  name: 'setup_featuremap',
  description: `Initialize FeatureMap for a new project — START HERE for new projects.

WHEN TO USE:
- User asks to "analyze my project", "setup featuremap", "scan my codebase"
- User wants to understand their project architecture
- First time using FeatureMap on a project

WHAT THIS TOOL DOES:
- Checks if project already has FeatureMap configuration
- If NOT initialized: scans folder structure and returns analysis
- If ALREADY initialized: returns current state and suggests next actions

═══════════════════════════════════════════════════════════════════
IMPORTANT: FULL SETUP WORKFLOW (follow these steps with user)
═══════════════════════════════════════════════════════════════════

When this tool returns status "not_initialized", guide user through 4 steps:

STEP 1 — Structure Analysis (this tool does it)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Show user the detected project parts:
- Which folders contain supported code (TypeScript, JavaScript, Go)
- Which folders cannot be parsed (Python, Rust, etc.)
- Mark legacy/old code with ⚠️

Ask user: "What should I scan?"
Options: All supported / Only active ones / Let me choose

STEP 2 — Save Config & Run Technical Scan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After user chooses what to scan:
1. Call save_project_config with chosen folders
2. Call run_scan to parse code and create clusters

Show results: X files processed, Y clusters created, Z dependencies found

Ask user: "Create features from these clusters?"

STEP 3 — Create Features
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If user agrees:
1. Call get_grouping_input to get cluster data
2. Analyze clusters and decide feature groupings
3. Call save_features_from_grouping with your groupings

Show created features with brief descriptions.

Ask user: "Create groups to organize features? (optional, good for large projects)"

STEP 4 — Create Groups (optional)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If user agrees:
1. Call create_groups_from_features to auto-group
   OR create_group for manual grouping

Show final summary: X files → Y clusters → Z features → N groups

═══════════════════════════════════════════════════════════════════
FORMATTING RULES
═══════════════════════════════════════════════════════════════════
- Show progress: "━━━ Step 2 of 4: Technical Scan ✓ ━━━"
- Use emojis for status: ✅ supported, ⚠️ legacy/warning, ❌ unsupported
- Always wait for user confirmation between major steps
- If user says "do everything automatically" — proceed but still show progress

═══════════════════════════════════════════════════════════════════`,
  parameters: {
    projectRoot: z
      .string()
      .optional()
      .describe('Project root path. Defaults to current working directory.'),
  },
  execute: async (params: { projectRoot?: string }) => {
    const projectRoot = params.projectRoot
      ? path.resolve(params.projectRoot)
      : process.cwd();
    const featuremapDir = findFeaturemapDir(projectRoot);

    if (featuremapDir) {
      const state = checkProjectState(featuremapDir);

      if (state.hasConfig) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: 'already_initialized',
                  message: 'Project already has FeatureMap configuration.',
                  state: {
                    clustersCount: state.clustersCount,
                    featuresCount: state.featuresCount,
                    groupsCount: state.groupsCount,
                  },
                  suggestions: [
                    'Use run_scan to rescan after code changes',
                    'Use get_current_features to see features',
                    'Use get_architecture_overview for project summary',
                  ],
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }

    try {
      const structure = await scanProjectStructure(projectRoot);
      const analysis = analyzeStructureForSetup(structure, projectRoot);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'not_initialized',
                message:
                  'Project needs FeatureMap setup. Follow the workflow in tool description.',
                projectRoot,
                detectedParts: analysis.parts,
                summary: {
                  totalFiles: analysis.totalFiles,
                  supportedFiles: analysis.supportedFiles,
                  unsupportedFiles: analysis.unsupportedFiles,
                  partsCount: analysis.parts.length,
                  supportedParts: analysis.parts.filter((part) => part.canParse).length,
                },
                nextStep: {
                  action: 'Ask user which parts to scan',
                  options: [
                    'All supported',
                    'Only active (exclude legacy)',
                    'Let user choose specific folders',
                  ],
                  thenCall: 'save_project_config',
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
};
