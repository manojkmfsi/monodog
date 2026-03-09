-- CreateTable
CREATE TABLE "PipelineLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publishPipelineId" TEXT NOT NULL,
    "packageName" TEXT,
    "stage" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PipelineLog_publishPipelineId_fkey" FOREIGN KEY ("publishPipelineId") REFERENCES "PublishPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PipelineLog_publishPipelineId_timestamp_idx" ON "PipelineLog"("publishPipelineId", "timestamp");

-- CreateIndex
CREATE INDEX "PipelineLog_publishPipelineId_packageName_idx" ON "PipelineLog"("publishPipelineId", "packageName");

-- CreateIndex
CREATE INDEX "PipelineLog_level_timestamp_idx" ON "PipelineLog"("level", "timestamp");
