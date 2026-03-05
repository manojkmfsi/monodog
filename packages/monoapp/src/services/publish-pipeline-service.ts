import { PrismaClient, PublishPipeline, PublishResult, TokenUsageLog } from '@prisma/client';

const prisma = new PrismaClient();

export class PublishPipelineService {
  /**
   * Create a new publish pipeline record
   */
  async createPipeline(data: Partial<PublishPipeline>): Promise<PublishPipeline> {
    return prisma.publishPipeline.create({ data: data as any });
  }

  /**
   * Update a publish pipeline record
   */
  async updatePipeline(id: string, data: Partial<PublishPipeline>): Promise<PublishPipeline> {
    return prisma.publishPipeline.update({ where: { id }, data: data as any });
  }

  /**
   * Get a publish pipeline by ID
   */
  async getPipeline(id: string): Promise<PublishPipeline | null> {
    return prisma.publishPipeline.findUnique({ where: { id } });
  }

  /**
   * List all pipelines (optionally filter by status)
   */
  async listPipelines(status?: string): Promise<PublishPipeline[]> {
    return prisma.publishPipeline.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Add a publish result to a pipeline
   */
  async addPublishResult(pipelineId: string, result: Partial<PublishResult>): Promise<PublishResult> {
    return prisma.publishResult.create({
      data: {
        ...result,
        publishPipelineId: pipelineId,
      } as any,
    });
  }

  /**
   * Get all results for a pipeline
   */
  async getResultsForPipeline(pipelineId: string): Promise<PublishResult[]> {
    return prisma.publishResult.findMany({
      where: { publishPipelineId: pipelineId },
      orderBy: { newVersion: 'desc' },
    });
  }

  /**
   * Log a token usage event
   */
  async logTokenUsage(data: Partial<TokenUsageLog>): Promise<TokenUsageLog> {
    return prisma.tokenUsageLog.create({ data: data as any });
  }
}

export const publishPipelineService = new PublishPipelineService();
