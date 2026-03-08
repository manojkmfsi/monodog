/**
 * Workflow Management Routes
 * Handles workflow CRUD operations for monodog-release.yaml
 */

import express, { Request, Response } from 'express';
import { workflowService } from '../services/workflow-service';
import { authenticationMiddleware } from '../middleware/auth-middleware';

const workflowMgmtRouter = express.Router();

/**
 * GET /api/workflows/check
 * Check if monodog-release.yaml exists
 */
workflowMgmtRouter.get(
  '/check',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const exists = await workflowService.workflowExists();
      res.json({
        success: true,
        exists,
        path: exists ? workflowService.getWorkflowPath() : null,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/workflows/create
 * Create default monodog-release.yaml
 * Body: { packageNames: string[] }
 */
workflowMgmtRouter.post(
  '/create',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { packageNames } = req.body as { packageNames: string[] };

      if (!packageNames || !Array.isArray(packageNames)) {
        res.status(400).json({
          success: false,
          error: 'packageNames array is required',
        });
        return;
      }

      const filePath = await workflowService.createDefaultWorkflow(packageNames);
      res.json({
        success: true,
        message: 'Workflow created successfully',
        filePath,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/workflows/read
 * Read monodog-release.yaml
 */
workflowMgmtRouter.get(
  '/read',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const workflow = await workflowService.readWorkflow();
      if (!workflow) {
        res.status(404).json({
          success: false,
          error: 'Workflow file not found',
        });
        return;
      }

      res.json({
        success: true,
        workflow,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/workflows/update
 * Update monodog-release.yaml
 * Body: { workflow: WorkflowConfig }
 */
workflowMgmtRouter.post(
  '/update',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { workflow } = req.body;

      if (!workflow) {
        res.status(400).json({
          success: false,
          error: 'workflow is required',
        });
        return;
      }

      await workflowService.saveWorkflow(workflow);
      res.json({
        success: true,
        message: 'Workflow updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/workflows/update-packages
 * Update selected packages in workflow
 * Body: { packageNames: string[] }
 */
workflowMgmtRouter.post(
  '/update-packages',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { packageNames } = req.body as { packageNames: string[] };

      if (!packageNames || !Array.isArray(packageNames)) {
        res.status(400).json({
          success: false,
          error: 'packageNames array is required',
        });
        return;
      }

      await workflowService.updateWorkflowPackages(packageNames);
      res.json({
        success: true,
        message: 'Selected packages updated in workflow',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/workflows/selected-packages
 * Get selected packages from workflow
 */
workflowMgmtRouter.get(
  '/selected-packages',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const packages = await workflowService.getSelectedPackages();
      res.json({
        success: true,
        packages,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/workflows/delete
 * Delete monodog-release.yaml
 */
workflowMgmtRouter.delete(
  '/delete',
  authenticationMiddleware,
  async (req: Request, res: Response) => {
    try {
      await workflowService.deleteWorkflow();
      res.json({
        success: true,
        message: 'Workflow deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default workflowMgmtRouter;
