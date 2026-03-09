/**
 * Pipeline Logger Service
 * Captures detailed pipeline execution logs to the database
 */

import * as PrismaPkg from '@prisma/client';

// Initialize Prisma Client - handle both module patterns
const PrismaClient =
  (PrismaPkg as any).PrismaClient ||
  (PrismaPkg as any).default?.PrismaClient ||
  (PrismaPkg as any).default ||
  PrismaPkg;

let prisma: any;
try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  prisma = null;
}

export interface PipelineLogEntry {
  publishPipelineId: string;
  packageName?: string;
  stage: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  details?: Record<string, any>;
}

export class PipelineLogger {
  /**
   * Log a pipeline event
   */
  async log(entry: PipelineLogEntry): Promise<void> {
    try {
      if (!prisma) {
        console.warn('Prisma client not initialized, skipping log:', entry.message);
        return;
      }

      if (!prisma.pipelineLog) {
        console.warn('PipelineLog model not available in Prisma client, skipping log:', entry.message);
        return;
      }

      await prisma.pipelineLog.create({
        data: {
          publishPipelineId: entry.publishPipelineId,
          packageName: entry.packageName,
          stage: entry.stage,
          level: entry.level,
          message: entry.message,
          details: entry.details ? JSON.stringify(entry.details) : undefined,
        },
      });
    } catch (error) {
      console.error('Failed to log pipeline event:', error);
      // Don't throw - logging should not block the main pipeline
    }
  }

  /**
   * Log info level message
   */
  async info(
    pipelineId: string,
    message: string,
    stage: string,
    packageName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      publishPipelineId: pipelineId,
      packageName,
      stage,
      level: 'info',
      message,
      details,
    });
  }

  /**
   * Log warning level message
   */
  async warn(
    pipelineId: string,
    message: string,
    stage: string,
    packageName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      publishPipelineId: pipelineId,
      packageName,
      stage,
      level: 'warning',
      message,
      details,
    });
  }

  /**
   * Log error level message
   */
  async error(
    pipelineId: string,
    message: string,
    stage: string,
    packageName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      publishPipelineId: pipelineId,
      packageName,
      stage,
      level: 'error',
      message,
      details,
    });
  }

  /**
   * Log debug level message
   */
  async debug(
    pipelineId: string,
    message: string,
    stage: string,
    packageName?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      publishPipelineId: pipelineId,
      packageName,
      stage,
      level: 'debug',
      message,
      details,
    });
  }

  /**
   * Get logs for a pipeline
   */
  async getPipelineLogs(
    pipelineId: string,
    filters?: {
      packageName?: string;
      stage?: string;
      level?: string;
    }
  ): Promise<any[]> {
    try {
      if (!prisma?.pipelineLog) {
        console.warn('PipelineLog model not available');
        return [];
      }

      return await prisma.pipelineLog.findMany({
        where: {
          publishPipelineId: pipelineId,
          ...(filters?.packageName && { packageName: filters.packageName }),
          ...(filters?.stage && { stage: filters.stage }),
          ...(filters?.level && { level: filters.level }),
        },
        orderBy: { timestamp: 'asc' },
      });
    } catch (error) {
      console.error('Failed to fetch pipeline logs:', error);
      return [];
    }
  }

  /**
   * Get recent logs across all pipelines
   */
  async getRecentLogs(
    limit: number = 100,
    filters?: {
      level?: string;
      stage?: string;
    }
  ): Promise<any[]> {
    try {
      if (!prisma?.pipelineLog) {
        console.warn('PipelineLog model not available');
        return [];
      }

      return await prisma.pipelineLog.findMany({
        where: {
          ...(filters?.level && { level: filters.level }),
          ...(filters?.stage && { stage: filters.stage }),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.error('Failed to fetch recent logs:', error);
      return [];
    }
  }

  /**
   * Get logs by stage for a pipeline
   */
  async getLogsByStage(
    pipelineId: string,
    stage: string
  ): Promise<any[]> {
    try {
      if (!prisma?.pipelineLog) {
        console.warn('PipelineLog model not available');
        return [];
      }

      return await prisma.pipelineLog.findMany({
        where: {
          publishPipelineId: pipelineId,
          stage,
        },
        orderBy: { timestamp: 'asc' },
      });
    } catch (error) {
      console.error('Failed to fetch stage logs:', error);
      return [];
    }
  }

  /**
   * Get error logs for a pipeline
   */
  async getErrorLogs(pipelineId: string): Promise<any[]> {
    try {
      if (!prisma?.pipelineLog) {
        console.warn('PipelineLog model not available');
        return [];
      }

      return await prisma.pipelineLog.findMany({
        where: {
          publishPipelineId: pipelineId,
          level: 'error',
        },
        orderBy: { timestamp: 'desc' },
      });
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
      return [];
    }
  }

  /**
   * Clear logs for a pipeline (cleanup)
   */
  async clearPipelineLogs(pipelineId: string): Promise<number> {
    try {
      if (!prisma?.pipelineLog) {
        console.warn('PipelineLog model not available');
        return 0;
      }

      const result = await prisma.pipelineLog.deleteMany({
        where: { publishPipelineId: pipelineId },
      });
      return result.count;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return 0;
    }
  }
}

export const pipelineLogger = new PipelineLogger();
