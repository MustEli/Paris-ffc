ALTER TABLE "IssueReport" ADD COLUMN "taskRef" TEXT;

CREATE INDEX "IssueReport_userId_taskRef_idx" ON "IssueReport"("userId", "taskRef");
