-- CreateTable
CREATE TABLE "ChangeTrack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "detectionMethod" TEXT NOT NULL,
    "detectionTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filesChanged" TEXT NOT NULL,
    "linesAdded" INTEGER NOT NULL DEFAULT 0,
    "linesRemoved" INTEGER NOT NULL DEFAULT 0,
    "changeType" TEXT NOT NULL,
    "affectedDependents" TEXT NOT NULL,
    "userOverrideType" TEXT,
    "overrideReason" TEXT,
    "overrideBy" TEXT,
    "overriddenAt" DATETIME,
    "isReleaseReady" BOOLEAN NOT NULL DEFAULT false,
    "lastAnalyzedCommit" TEXT NOT NULL,
    "previousVersion" TEXT NOT NULL,
    "proposedVersion" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommitChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeTrackId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorEmail" TEXT,
    "type" TEXT NOT NULL,
    "scope" TEXT,
    "isBreaking" BOOLEAN NOT NULL DEFAULT false,
    "bodyText" TEXT,
    "committedAt" DATETIME NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommitChange_changeTrackId_fkey" FOREIGN KEY ("changeTrackId") REFERENCES "ChangeTrack" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VersionCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageName" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "proposedVersion" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "affectedDependents" TEXT NOT NULL,
    "majorBumps" INTEGER NOT NULL DEFAULT 0,
    "minorBumps" INTEGER NOT NULL DEFAULT 0,
    "patchBumps" INTEGER NOT NULL DEFAULT 0,
    "breakingChanges" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PublishPipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageNames" TEXT NOT NULL,
    "releaseVersion" TEXT,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "conclusion" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "releaseNotes" TEXT,
    "errorMessage" TEXT,
    "errorDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublishResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publishPipelineId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "newVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "npmPackageId" TEXT,
    "tarballUrl" TEXT,
    "publishedAt" DATETIME,
    "gitTagCreated" TEXT,
    "gitCommitSha" TEXT,
    "gitPushCompleted" BOOLEAN NOT NULL DEFAULT false,
    "githubReleaseUrl" TEXT,
    "error" TEXT,
    "errorDetails" TEXT,
    CONSTRAINT "PublishResult_publishPipelineId_fkey" FOREIGN KEY ("publishPipelineId") REFERENCES "PublishPipeline" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TokenUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT
);

-- CreateTable
CREATE TABLE "UserSecret" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "secretName" TEXT NOT NULL,
    "secretType" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME
);

-- CreateIndex
CREATE INDEX "ChangeTrack_packageName_createdAt_idx" ON "ChangeTrack"("packageName", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeTrack_isReleaseReady_packageName_idx" ON "ChangeTrack"("isReleaseReady", "packageName");

-- CreateIndex
CREATE INDEX "CommitChange_changeTrackId_hash_idx" ON "CommitChange"("changeTrackId", "hash");

-- CreateIndex
CREATE INDEX "CommitChange_hash_idx" ON "CommitChange"("hash");

-- CreateIndex
CREATE INDEX "VersionCalculation_packageName_proposedVersion_idx" ON "VersionCalculation"("packageName", "proposedVersion");

-- CreateIndex
CREATE INDEX "PublishPipeline_status_createdAt_idx" ON "PublishPipeline"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PublishPipeline_triggeredBy_createdAt_idx" ON "PublishPipeline"("triggeredBy", "createdAt");

-- CreateIndex
CREATE INDEX "PublishResult_publishPipelineId_idx" ON "PublishResult"("publishPipelineId");

-- CreateIndex
CREATE INDEX "PublishResult_packageName_newVersion_idx" ON "PublishResult"("packageName", "newVersion");

-- CreateIndex
CREATE INDEX "TokenUsageLog_userId_timestamp_idx" ON "TokenUsageLog"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "TokenUsageLog_tokenType_timestamp_idx" ON "TokenUsageLog"("tokenType", "timestamp");

-- CreateIndex
CREATE INDEX "UserSecret_userId_idx" ON "UserSecret"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSecret_userId_secretName_key" ON "UserSecret"("userId", "secretName");
