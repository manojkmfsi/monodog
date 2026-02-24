/**
 * Pipeline Management Service
 * Handles pipeline tracking, storage, and real-time updates
 */

import * as PrismaPkg from '@prisma/client';

const PrismaClient = (PrismaPkg as any).PrismaClient || (PrismaPkg as any).default || PrismaPkg;

import type {
  ReleasePipeline,
  WorkflowRun,
  WorkflowJob,
  JobLogs,
  PipelineAuditLog as AuditLogType,
} from '../types/github-actions';
import * as githubActionsService from './github-actions-service';
import { AppLogger } from '../middleware/logger';

const prisma = new PrismaClient();

/**
 * Create or update a release pipeline
 */
export async function createOrUpdatePipeline(
  pipeline: Omit<ReleasePipeline, 'id' | 'workflowRuns' | 'createdAt' | 'updatedAt'>
): Promise<{
  id: string;
  releaseVersion: string;
  packageName: string;
}> {
  try {
    // Check if pipeline already exists for this release
    const existing = await prisma.releasePipeline.findFirst({
      where: {
        releaseVersion: pipeline.releaseVersion,
        packageName: pipeline.packageName,
        owner: pipeline.owner,
        repo: pipeline.repo,
      },
    });

    let result;
    if (existing) {
      result = await prisma.releasePipeline.update({
        where: { id: existing.id },
        data: {
          currentStatus: pipeline.currentStatus,
          currentConclusion: pipeline.currentConclusion,
          lastRunId: pipeline.lastRunId ? String(pipeline.lastRunId) : null,
          triggeredAt: pipeline.triggeredAt,
        },
      });
    } else {
      result = await prisma.releasePipeline.create({
        data: {
          releaseVersion: pipeline.releaseVersion,
          packageName: pipeline.packageName,
          owner: pipeline.owner,
          repo: pipeline.repo,
          workflowId: pipeline.workflowId,
          workflowName: pipeline.workflowName,
          workflowPath: pipeline.workflowPath,
          triggerType: pipeline.triggerType,
          triggeredBy: pipeline.triggeredBy,
          triggeredAt: pipeline.triggeredAt,
          currentStatus: pipeline.currentStatus,
          currentConclusion: pipeline.currentConclusion,
          lastRunId: pipeline.lastRunId ? String(pipeline.lastRunId) : null,
        },
      });
    }

    return {
      id: result.id,
      releaseVersion: result.releaseVersion,
      packageName: result.packageName,
    };
  } catch (error) {
    AppLogger.error(`Failed to create/update pipeline: ${error}`);
    throw error;
  }
}

/**
 * Update pipeline status and conclusion based on workflow run
 */
export async function updatePipelineStatus(
  pipelineId: string,
  currentStatus: string,
  currentConclusion: string | null,
  lastRunId?: string
): Promise<any> {
  try {
    const result = await prisma.releasePipeline.update({
      where: { id: pipelineId },
      data: {
        currentStatus,
        currentConclusion,
        ...(lastRunId && { lastRunId: String(lastRunId) }),
        updatedAt: new Date(),
      },
    });

    AppLogger.info(
      `Updated pipeline ${pipelineId}: status=${currentStatus}, conclusion=${currentConclusion}`
    );

    return result;
  } catch (error) {
    AppLogger.error(`Failed to update pipeline status: ${error}`);
    throw error;
  }
}

/**
 * Store workflow run in database
 */
// export async function storeWorkflowRun(
//   pipelineId: string,
//   run: any // WorkflowRun type
// ): Promise<string> {
//   try {
//     const result = await prisma.workflowRun.upsert({
//       where: { gitHubRunId: run.id },
//       update: {
//         status: run.status,
//         conclusion: run.conclusion,
//         updatedAt: new Date(run.updated_at),
//       },
//       create: {
//         gitHubRunId: run.id,
//         gitHubNodeId: run.node_id,
//         name: run.name,
//         displayTitle: run.display_title,
//         runNumber: run.run_number,
//         event: run.event,
//         status: run.status,
//         conclusion: run.conclusion,
//         htmlUrl: run.html_url,
//         workflowId: run.workflow_id,
//         workflowPath: run.path,
//         headBranch: run.head_branch,
//         headSha: run.head_sha,
//         createdAt: new Date(run.created_at),
//         updatedAt: new Date(run.updated_at),
//         runStartedAt: run.run_started_at ? new Date(run.run_started_at) : null,
//         pipelineId,
//         actor: run.actor?.login || 'unknown',
//         triggeringActor: run.triggering_actor?.login,
//       },
//     });

//     return result.id;
//   } catch (error) {
//     AppLogger.error(`Failed to store workflow run: ${error}`);
//     throw error;
//   }
// }

/**
 * Store workflow jobs for a run
 */
// export async function storeWorkflowJobs(
//   workflowRunId: string,
//   jobs: any[] // WorkflowJob[]
// ): Promise<string[]> {
//   try {
//     const createdJobIds: string[] = [];

//     for (const job of jobs) {
//       const result = await prisma.workflowJob.upsert({
//         where: { gitHubJobId: job.id },
//         update: {
//           status: job.status,
//           conclusion: job.conclusion,
//         },
//         create: {
//           gitHubJobId: job.id,
//           gitHubNodeId: job.node_id,
//           name: job.name,
//           runUrl: job.run_url,
//           htmlUrl: job.html_url,
//           status: job.status,
//           conclusion: job.conclusion,
//           headSha: job.head_sha,
//           startedAt: job.started_at ? new Date(job.started_at) : null,
//           completedAt: job.completed_at ? new Date(job.completed_at) : null,
//           runnerId: job.runner_id,
//           runnerName: job.runner_name,
//           runnerGroupId: job.runner_group_id,
//           runnerGroupName: job.runner_group_name,
//           runId: workflowRunId,
//           labels: JSON.stringify(job.labels || []),
//         },
//       });

//       createdJobIds.push(result.id);

//       // Store steps
//       if (job.steps && Array.isArray(job.steps)) {
//         for (const step of job.steps) {
//           await prisma.workflowStep.upsert({
//             where: {
//               id: `${result.id}-${step.number}`,
//             },
//             update: {
//               status: step.status,
//               conclusion: step.conclusion,
//             },
//             create: {
//               id: `${result.id}-${step.number}`,
//               name: step.name,
//               stepNumber: step.number,
//               status: step.status,
//               conclusion: step.conclusion,
//               startedAt: step.started_at ? new Date(step.started_at) : null,
//               completedAt: step.completed_at
//                 ? new Date(step.completed_at)
//                 : null,
//               jobId: result.id,
//             },
//           });
//         }
//       }
//     }

//     return createdJobIds;
//   } catch (error) {
//     AppLogger.error(`Failed to store workflow jobs: ${error}`);
//     throw error;
//   }
// }

/**
 * Store job logs
 */
// export async function storeJobLogs(
//   jobId: string,
//   logs: any, // JobLogs
//   rawLogUrl: string
// ): Promise<void> {
//   try {
//     await prisma.jobLog.upsert({
//       where: { jobId },
//       update: {
//         logLines: JSON.stringify(logs.steps.flatMap((s: any) => s.logs)),
//         updatedAt: new Date(),
//       },
//       create: {
//         jobId,
//         logLines: JSON.stringify(logs.steps.flatMap((s: any) => s.logs)),
//         rawLogUrl,
//         totalLines: logs.steps.reduce(
//           (sum: number, s: any) => sum + (s.logs?.length || 0),
//           0
//         ),
//         hasPreviousLogs: logs.hasPreviousLogs,
//         hasMoreLogs: logs.hasMoreLogs,
//       },
//     });
//   } catch (error) {
//     AppLogger.error(`Failed to store job logs: ${error}`);
//     throw error;
//   }
// }

/**
 * Create audit log entry
 */
export async function createAuditLog(
  pipelineId: string,
  userId: number,
  username: string,
  action: string,
  resourceType: string,
  resourceId: string,
  resourceName: string,
  details: Record<string, unknown> = {},
  status: 'success' | 'failure' | 'pending' = 'success',
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.pipelineAuditLog.create({
      data: {
        pipelineId,
        userId,
        username,
        action,
        resourceType,
        resourceId,
        resourceName,
        details: JSON.stringify(details),
        status,
        errorMessage,
      },
    });
  } catch (error) {
    AppLogger.error(`Failed to create audit log: ${error}`);
    throw error;
  }
}

/**
 * Get audit logs for a pipeline
 */
export async function getPipelineAuditLogs(
  pipelineId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  try {
    return await prisma.pipelineAuditLog.findMany({
      where: { pipelineId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  } catch (error) {
    AppLogger.error(`Failed to get audit logs: ${error}`);
    throw error;
  }
}

/**
 * Get recent pipelines for dashboard
 */
export async function getRecentPipelines(
  limit: number = 20,
  offset: number = 0
): Promise<any[]> {
  try {
    const pipelines = await prisma.releasePipeline.findMany({
      orderBy: { triggeredAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Enrich with workflowPath if not already set (should be set in database now)
    return pipelines.map((p: ReleasePipeline) => ({
      ...p,
      workflowPath: p.workflowPath || 'release.yml',
    }));
  } catch (error) {
    AppLogger.error(`Failed to get recent pipelines: ${error}`);
    throw error;
  }
}


/**
 * Delete old pipelines (cleanup)
 */
export async function deleteOldPipelines(daysOld: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.releasePipeline.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    AppLogger.info(`Deleted ${result.count} old pipelines`);
    return result.count;
  } catch (error) {
    AppLogger.error(`Failed to delete old pipelines: ${error}`);
    throw error;
  }
}
