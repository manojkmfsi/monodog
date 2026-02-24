"use strict";
/**
 * Pipeline Management Service
 * Handles pipeline tracking, storage, and real-time updates
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdatePipeline = createOrUpdatePipeline;
exports.updatePipelineStatus = updatePipelineStatus;
exports.createAuditLog = createAuditLog;
exports.getPipelineAuditLogs = getPipelineAuditLogs;
exports.getRecentPipelines = getRecentPipelines;
exports.deleteOldPipelines = deleteOldPipelines;
const PrismaPkg = __importStar(require("@prisma/client"));
const PrismaClient = PrismaPkg.PrismaClient || PrismaPkg.default || PrismaPkg;
const logger_1 = require("../middleware/logger");
const prisma = new PrismaClient();
/**
 * Create or update a release pipeline
 */
async function createOrUpdatePipeline(pipeline) {
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
        }
        else {
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
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to create/update pipeline: ${error}`);
        throw error;
    }
}
/**
 * Update pipeline status and conclusion based on workflow run
 */
async function updatePipelineStatus(pipelineId, currentStatus, currentConclusion, lastRunId) {
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
        logger_1.AppLogger.info(`Updated pipeline ${pipelineId}: status=${currentStatus}, conclusion=${currentConclusion}`);
        return result;
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to update pipeline status: ${error}`);
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
async function createAuditLog(pipelineId, userId, username, action, resourceType, resourceId, resourceName, details = {}, status = 'success', errorMessage) {
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
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to create audit log: ${error}`);
        throw error;
    }
}
/**
 * Get audit logs for a pipeline
 */
async function getPipelineAuditLogs(pipelineId, limit = 50, offset = 0) {
    try {
        return await prisma.pipelineAuditLog.findMany({
            where: { pipelineId },
            orderBy: { timestamp: 'desc' },
            take: limit,
            skip: offset,
        });
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to get audit logs: ${error}`);
        throw error;
    }
}
/**
 * Get recent pipelines for dashboard
 */
async function getRecentPipelines(limit = 20, offset = 0) {
    try {
        const pipelines = await prisma.releasePipeline.findMany({
            orderBy: { triggeredAt: 'desc' },
            take: limit,
            skip: offset
        });
        // Enrich with workflowPath if not already set (should be set in database now)
        return pipelines.map((p) => ({
            ...p,
            workflowPath: p.workflowPath || 'release.yml',
        }));
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to get recent pipelines: ${error}`);
        throw error;
    }
}
/**
 * Delete old pipelines (cleanup)
 */
async function deleteOldPipelines(daysOld = 90) {
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
        logger_1.AppLogger.info(`Deleted ${result.count} old pipelines`);
        return result.count;
    }
    catch (error) {
        logger_1.AppLogger.error(`Failed to delete old pipelines: ${error}`);
        throw error;
    }
}
