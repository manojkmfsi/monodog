/**
 * Workflow Service
 * Manages monodog-release.yaml workflow files
 * Creates default workflows, validates, and edits them
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { findMonorepoRoot } from '../utils/utilities';

export interface WorkflowConfig {
  name: string;
  on: {
    workflow_dispatch: {
      inputs?: {
        packages?: {
          description: string;
          required: boolean;
          default: string;
        };
      };
    };
  };
  jobs: {
    release: {
      'runs-on': string;
      steps: Array<{
        name: string;
        uses?: string;
        run?: string;
        'working-directory'?: string;
        with?: Record<string, any>;
        if?: string;
      }>;
    };
  };
}

export class WorkflowService {
  private workflowDir: string;
  private workflowFile: string;

  constructor(rootPath: string = process.cwd()) {
    this.workflowDir = path.join(rootPath, '.github', 'workflows');
    this.workflowFile = path.join(this.workflowDir, 'monodog-release.yaml');
  }

  /**
   * Check if monodog-release.yaml exists
   */
  async workflowExists(): Promise<boolean> {
    try {
      await fs.promises.access(this.workflowFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create default workflow file
   */
  async createDefaultWorkflow(packageNames: string[]): Promise<string> {
    // Ensure directory exists
    await fs.promises.mkdir(this.workflowDir, { recursive: true });

    const workflow = this.generateWorkflowYaml(packageNames);
    const yamlContent = yaml.dump(workflow, { indent: 2 });

    await fs.promises.writeFile(this.workflowFile, yamlContent, 'utf-8');
    return this.workflowFile;
  }

  /**
   * Generate default workflow YAML configuration
   */
  private generateWorkflowYaml(packageNames: string[]): WorkflowConfig {
    const defaultPackages = packageNames.join(',');

    return {
      name: 'Monodog Release Workflow',
      on: {
        workflow_dispatch: {
          inputs: {
            packages: {
              description:
                'Comma-separated list of packages to release (e.g., @monodog/utils,@monodog/backend)',
              required: true,
              default: defaultPackages,
            },
          },
        },
      },
      jobs: {
        release: {
          'runs-on': 'ubuntu-latest',
          steps: [
            {
              name: 'Checkout repository',
              uses: 'actions/checkout@v3',
            },
            {
              name: 'Set up Node.js',
              uses: 'actions/setup-node@v3',
              with: {
                'node-version': '20',
              },
            },
            {
              name: 'Setup pnpm',
              uses: 'pnpm/action-setup@v2',
              with: {
                version: '8',
              },
            },
            {
              name: 'Install dependencies',
              run: 'pnpm install --no-frozen-lockfile',
            },
            {
              name: 'Generate Prisma client',
              'working-directory': 'packages/monoapp',
              run: 'npm run generate',
            },
            {
              name: 'Build packages',
              run: 'pnpm run build',
            },
            // {
            //   name: 'Run tests',
            //   run: 'pnpm test',
            // },
            {
              name: 'Release selected packages',
              'working-directory': 'packages/monoapp',
              run: 'npm run release -- --packages="${{ inputs.packages }}"',
              if: '${{ inputs.packages }}',
            },
          ],
        },
      },
    };
  }

  /**
   * Read workflow file
   */
  async readWorkflow(): Promise<WorkflowConfig | null> {
    try {
      const content = await fs.promises.readFile(this.workflowFile, 'utf-8');
      const workflow = yaml.load(content) as WorkflowConfig;
      return workflow;
    } catch (error) {
      console.error('Error reading workflow:', error);
      return null;
    }
  }

  /**
   * Update workflow with new package list
   */
  async updateWorkflowPackages(packageNames: string[]): Promise<void> {
    const workflow = await this.readWorkflow();
    if (!workflow) {
      throw new Error('Workflow file not found');
    }

    if (workflow.on?.workflow_dispatch?.inputs?.packages) {
      workflow.on.workflow_dispatch.inputs.packages.default = packageNames.join(
        ','
      );
    }

    const yamlContent = yaml.dump(workflow, { indent: 2 });
    await fs.promises.writeFile(this.workflowFile, yamlContent, 'utf-8');
  }

  /**
   * Save edited workflow
   */
  async saveWorkflow(workflow: WorkflowConfig): Promise<void> {
    const yamlContent = yaml.dump(workflow, { indent: 2 });
    await fs.promises.writeFile(this.workflowFile, yamlContent, 'utf-8');
  }

  /**
   * Get selected packages from workflow
   */
  async getSelectedPackages(): Promise<string[]> {
    const workflow = await this.readWorkflow();
    if (
      !workflow?.on?.workflow_dispatch?.inputs?.packages?.default
    ) {
      return [];
    }

    return workflow.on.workflow_dispatch.inputs.packages.default
      .split(',')
      .map(p => p.trim())
      .filter(p => p);
  }

  /**
   * Delete workflow file
   */
  async deleteWorkflow(): Promise<void> {
    try {
      await fs.promises.unlink(this.workflowFile);
    } catch (error) {
      console.error('Error deleting workflow:', error);
    }
  }

  /**
   * Get workflow file path
   */
  getWorkflowPath(): string {
    return this.workflowFile;
  }
}

export const workflowService = new WorkflowService(findMonorepoRoot());
