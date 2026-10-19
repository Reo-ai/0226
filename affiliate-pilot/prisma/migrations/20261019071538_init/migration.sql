-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experienceLevel" TEXT NOT NULL,
    "dailyWorkMinutes" INTEGER NOT NULL,
    "monthlyBudget" INTEGER NOT NULL,
    "preferredPlatforms" TEXT NOT NULL,
    "niche" TEXT NOT NULL DEFAULT '',
    "hasExistingAccount" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "targetMonthlyRevenue" INTEGER NOT NULL,
    "targetDate" DATETIME NOT NULL,
    "challengeMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Goal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Roadmap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "currentPhase" INTEGER NOT NULL DEFAULT 1,
    "progress" REAL NOT NULL DEFAULT 0,
    "plan" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Roadmap_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followerCount" INTEGER,
    "impressions30d" INTEGER,
    "clicks30d" INTEGER,
    "conversions30d" INTEGER,
    "niche" TEXT NOT NULL DEFAULT '',
    "affiliateOfferId" TEXT,
    "commissionPerApproval" INTEGER,
    "approvalRate" REAL,
    "ctr" REAL,
    "cvr" REAL,
    "dailyWorkMinutes" INTEGER NOT NULL,
    "approvalTimingNote" TEXT NOT NULL DEFAULT '',
    "readiness" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Challenge_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Challenge_affiliateOfferId_fkey" FOREIGN KEY ("affiliateOfferId") REFERENCES "AffiliateOffer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountUrl" TEXT NOT NULL DEFAULT '',
    "followerCount" INTEGER,
    "monthlyImpressions" INTEGER,
    "monthlyPosts" INTEGER,
    "monthlyEngagements" INTEGER,
    "monthlyProfileVisits" INTEGER,
    "monthlyClicks" INTEGER,
    "monthlyConversions" INTEGER,
    "niche" TEXT NOT NULL DEFAULT '',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelAccount_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelAccountId" TEXT NOT NULL,
    "trafficScore" INTEGER,
    "engagementScore" INTEGER,
    "funnelScore" INTEGER,
    "offerFitScore" INTEGER,
    "conversionScore" INTEGER,
    "overallScore" INTEGER,
    "confidenceLevel" REAL NOT NULL,
    "stage" TEXT NOT NULL,
    "recommendations" TEXT NOT NULL,
    "assessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountAssessment_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AffiliateNetwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "registrationGuide" TEXT NOT NULL,
    "lastVerifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AffiliateOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateNetworkId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "offerUrl" TEXT NOT NULL DEFAULT '',
    "commissionAmount" INTEGER,
    "commissionType" TEXT NOT NULL DEFAULT 'fixed',
    "commissionRate" REAL,
    "averageOrderValue" INTEGER,
    "conversionConditions" TEXT NOT NULL DEFAULT '',
    "rejectionConditions" TEXT NOT NULL DEFAULT '',
    "approvalRate" REAL,
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "partnershipStatus" TEXT NOT NULL DEFAULT 'candidate',
    "approvalTiming" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "lastVerifiedAt" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateOffer_affiliateNetworkId_fkey" FOREIGN KEY ("affiliateNetworkId") REFERENCES "AffiliateNetwork" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL DEFAULT '',
    "inputs" TEXT NOT NULL DEFAULT '{}',
    "checks" TEXT NOT NULL DEFAULT '{}',
    "affiliateOfferId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generatedBy" TEXT NOT NULL,
    "videoStatus" TEXT NOT NULL DEFAULT '',
    "videoTheme" TEXT NOT NULL DEFAULT '',
    "videoService" TEXT NOT NULL DEFAULT '',
    "videoResult" TEXT NOT NULL DEFAULT '',
    "videoUpdatedAt" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentDraft_affiliateOfferId_fkey" FOREIGN KEY ("affiliateOfferId") REFERENCES "AffiliateOffer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentDraftId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "publishedUrl" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    CONSTRAINT "Publication_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "ContentDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "taskDate" DATETIME,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "relatedFeature" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'rule',
    "ruleKey" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Task_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "lessonOrder" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "referenceUrls" TEXT NOT NULL DEFAULT '[]',
    "lastReviewedAt" DATETIME
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completionStatus" TEXT NOT NULL DEFAULT 'not_started',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "quizScore" REAL,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LessonProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuizAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PerformanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dedupeKey" TEXT NOT NULL,
    "recordDate" DATETIME NOT NULL,
    "platform" TEXT NOT NULL,
    "channelAccountId" TEXT,
    "affiliateOfferId" TEXT,
    "publicationId" TEXT,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "conversions" INTEGER,
    "approvedConversions" INTEGER,
    "pendingRevenue" INTEGER,
    "confirmedRevenue" INTEGER,
    "paidRevenue" INTEGER,
    "workMinutes" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PerformanceRecord_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PerformanceRecord_affiliateOfferId_fkey" FOREIGN KEY ("affiliateOfferId") REFERENCES "AffiliateOffer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PerformanceRecord_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "affiliateOfferId" TEXT,
    "platform" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingLink_affiliateOfferId_fkey" FOREIGN KEY ("affiliateOfferId") REFERENCES "AffiliateOffer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LinkClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "TrackingLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendationType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'open',
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "automationJobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationLog_automationJobId_fkey" FOREIGN KEY ("automationJobId") REFERENCES "AutomationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Goal_profileId_idx" ON "Goal"("profileId");

-- CreateIndex
CREATE INDEX "Roadmap_goalId_idx" ON "Roadmap"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_goalId_key" ON "Challenge"("goalId");

-- CreateIndex
CREATE INDEX "ChannelAccount_profileId_idx" ON "ChannelAccount"("profileId");

-- CreateIndex
CREATE INDEX "AccountAssessment_channelAccountId_assessedAt_idx" ON "AccountAssessment"("channelAccountId", "assessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateNetwork_slug_key" ON "AffiliateNetwork"("slug");

-- CreateIndex
CREATE INDEX "AffiliateOffer_partnershipStatus_idx" ON "AffiliateOffer"("partnershipStatus");

-- CreateIndex
CREATE INDEX "ContentDraft_status_idx" ON "ContentDraft"("status");

-- CreateIndex
CREATE INDEX "ContentDraft_videoStatus_videoUpdatedAt_idx" ON "ContentDraft"("videoStatus", "videoUpdatedAt");

-- CreateIndex
CREATE INDEX "Publication_contentDraftId_idx" ON "Publication"("contentDraftId");

-- CreateIndex
CREATE INDEX "Task_profileId_status_taskDate_idx" ON "Task"("profileId", "status", "taskDate");

-- CreateIndex
CREATE UNIQUE INDEX "Task_profileId_ruleKey_key" ON "Task"("profileId", "ruleKey");

-- CreateIndex
CREATE INDEX "Lesson_courseId_lessonOrder_idx" ON "Lesson"("courseId", "lessonOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_profileId_lessonId_key" ON "LessonProgress"("profileId", "lessonId");

-- CreateIndex
CREATE INDEX "QuizAttempt_profileId_lessonId_idx" ON "QuizAttempt"("profileId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceRecord_dedupeKey_key" ON "PerformanceRecord"("dedupeKey");

-- CreateIndex
CREATE INDEX "PerformanceRecord_recordDate_idx" ON "PerformanceRecord"("recordDate");

-- CreateIndex
CREATE INDEX "PerformanceRecord_platform_recordDate_idx" ON "PerformanceRecord"("platform", "recordDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_code_key" ON "TrackingLink"("code");

-- CreateIndex
CREATE INDEX "LinkClick_linkId_createdAt_idx" ON "LinkClick"("linkId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_status_createdAt_idx" ON "AIRecommendation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationJob_status_createdAt_idx" ON "AutomationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationLog_automationJobId_createdAt_idx" ON "AutomationLog"("automationJobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceReference_refKey_url_key" ON "SourceReference"("refKey", "url");
