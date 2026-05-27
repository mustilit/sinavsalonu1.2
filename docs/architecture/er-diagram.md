# ER Diagram

> Bu dosya `scripts/generate-er-diagram.js` tarafından otomatik üretildi.
> Elle düzenleme; schema.prisma değişince CI tarafından yeniden üretilir.

**Toplam:** 55 model, 27 enum, 152 ilişki

```mermaid
erDiagram
  Tenant {
    String id PK
    String name
    String slug UK
    Boolean isActive
    DateTime createdAt
    DateTime updatedAt
  }
  User {
    String id PK
    String email UK
    String username UK
    String firstName
    String lastName
    String passwordHash
    String googleId UK
    String bio
    UserRole role
    UserStatus status
    DateTime educatorApprovedAt
    DateTime lastLoginAt
    String passwordResetToken UK
    DateTime passwordResetTokenExpiresAt
    Boolean emailVerified
    rest_35_fields  "..."
  }
  UserPreference {
    String id PK
    String userId UK
    Json preferences
    DateTime createdAt
    DateTime updatedAt
    User user FK
  }
  ExamType {
    String id PK
    String name
    String description
    Json metadata
    DateTime createdAt
    DateTime updatedAt
    String slug UK
    Boolean active
  }
  Topic {
    String id PK
    String name
    String slug
    Boolean active
    String parentId
    DateTime createdAt
    Topic parent FK
    Topic children FK
  }
  TopicExamType {
    String topicId
    String examTypeId
    Topic topic FK
    ExamType examType FK
  }
  ExamTest {
    String id PK
    String title
    String examTypeId
    String topicId
    String educatorId
    Boolean isTimed
    Int duration
    Int priceCents
    Int campaignPriceCents
    DateTime campaignValidFrom
    DateTime campaignValidUntil
    Currency currency
    Currency campaignCurrency
    Int questionCount
    Boolean hasSolutions
    rest_14_fields  "..."
  }
  ExamQuestion {
    String id PK
    String testId
    String content
    String mediaUrl
    Int order
    String solutionText
    String solutionMediaUrl
    ModerationStatus moderationStatus
    DateTime moderatedAt
    DateTime createdAt
    DateTime updatedAt
    ExamTest test FK
  }
  ExamOption {
    String id PK
    String questionId
    String content
    String mediaUrl
    Boolean isCorrect
    ModerationStatus moderationStatus
    DateTime moderatedAt
    DateTime createdAt
    DateTime updatedAt
    ExamQuestion question FK
  }
  TestAttempt {
    String id PK
    String testId
    String candidateId
    DateTime startedAt
    DateTime completedAt
    DateTime submittedAt
    AttemptStatus status
    Float score
    Json metadata
    DateTime lastResumedAt
    DateTime pausedAt
    DateTime finishedAt
    Int remainingSec
    Int overtimeSeconds
    Json questionsSnapshot
    rest_2_fields  "..."
  }
  TestStats {
    String id PK
    String testId UK
    Float ratingAvg
    Int ratingCount
    Int purchaseCount
    DateTime updatedAt
  }
  AttemptAnswer {
    String id PK
    String attemptId
    String questionId
    String selectedOptionId
    Boolean isCorrect
    DateTime createdAt
    DateTime updatedAt
    TestAttempt attempt FK
    ExamQuestion question FK
    ExamOption option FK
  }
  Purchase {
    String id PK
    String testId
    String candidateId
    Int amountCents
    Currency currency
    Int amountUsdCents
    PurchaseStatus status
    DateTime createdAt
    DateTime updatedAt
    DateTime refundedAt
    DateTime expiredAt
    DateTime deletedAt
    String tenantId
    Tenant tenant FK
    ExamTest test FK
    rest_7_fields  "..."
  }
  TestPackage {
    String id PK
    String tenantId
    String educatorId
    String title
    String description
    String coverImageUrl
    Int priceCents
    Currency currency
    String difficulty
    Boolean isActive
    DateTime publishedAt
    DateTime createdAt
    DateTime updatedAt
    Tenant tenant FK
    User educator FK
  }
  PackageView {
    String id PK
    String tenantId
    String packageId
    String viewerId
    String sessionId
    String ipHash
    String referrer
    String userAgent
    DateTime createdAt
    Tenant tenant FK
    TestPackage package FK
    User viewer FK
  }
  Follow {
    String id PK
    String followerId
    FollowType followType
    String educatorId
    String examTypeId
    Boolean notificationsEnabled
    DateTime createdAt
  }
  NotificationPreference {
    String id PK
    String userId UK
    Boolean emailEnabled
    Boolean weeklyDigestEnabled
    Boolean inactiveReminderEnabled
    String unsubscribeToken UK
    DateTime createdAt
    DateTime updatedAt
    User user FK
  }
  AuditLog {
    String id PK
    AuditAction action
    String entityType
    String entityId
    String actorId
    String tenantId
    String actorEmail
    String actorRole
    Json before
    Json after
    String ip
    String userAgent
    Json metadata
    DateTime createdAt
  }
  DiscountCode {
    String id PK
    String code UK
    String description
    Int percentOff
    Int maxUses
    Int usedCount
    Boolean isActive
    DateTime validFrom
    DateTime validUntil
    DateTime createdAt
    String createdById
    User createdBy FK
  }
  Objection {
    String id PK
    String attemptId
    String questionId
    String reporterId
    String reason
    ObjectionStatus status
    String answerText
    DateTime createdAt
    DateTime answeredAt
    DateTime escalatedAt
    String moderationResultId
    String adminAnswerText
    DateTime adminAnsweredAt
    String adminAnswererId
    TestAttempt attempt FK
    rest_3_fields  "..."
  }
  RefundRequest {
    String id PK
    String purchaseId UK
    String candidateId
    String educatorId
    String testId
    String reason
    String description
    Currency currency
    RefundStatus status
    DateTime educatorDeadline
    DateTime educatorDecidedAt
    String appealReason
    DateTime appealedAt
    String decidedBy
    DateTime decidedAt
    rest_3_fields  "..."
  }
  Review {
    String id PK
    String packageId
    String testId
    String educatorId
    String candidateId
    Int testRating
    Int educatorRating
    String comment
    DateTime createdAt
    DateTime updatedAt
  }
  Contract {
    String id PK
    ContractType type
    Int version
    String title
    String content
    Boolean isActive
    DateTime publishedAt
    DateTime createdAt
    DateTime updatedAt
  }
  ContractAcceptance {
    String id PK
    String userId
    String contractId
    DateTime acceptedAt
    String ip
    String userAgent
    User user FK
    Contract contract FK
  }
  UserDevice {
    String id PK
    String userId
    String fingerprint
    String userAgent
    String ip
    Boolean trusted
    String trustToken UK
    DateTime trustTokenExpiresAt
    DateTime firstSeenAt
    DateTime lastSeenAt
    User user FK
  }
  AdminSettings {
    Int id PK
    Int commissionPercent
    Int vatPercent
    Boolean purchasesEnabled
    Boolean packageCreationEnabled
    Boolean testPublishingEnabled
    Boolean testAttemptsEnabled
    Boolean adPurchasesEnabled
    Boolean twoFactorSystemEnabled
    Int minPackagePriceCents
    Int maxDiscountPercent
    String googleClientId
    String turnstileSiteKey
    String turnstileSecretKey
    Int minQuestionsPerTest
    rest_34_fields  "..."
  }
  CommissionRateHistory {
    String id PK
    Int commissionPercent
    DateTime effectiveFrom
    String note
    DateTime createdAt
  }
  SiteSettings {
    Int id PK
    String siteName
    String heroTitle
    String heroSubtitle
    String searchPlaceholder
    String statTests
    String statEducators
    String statCandidates
    String statSuccessRate
    String footerDescription
    String companyName
    String contactEmail
    String contactPhone
    String address
    String linkAbout
    rest_6_fields  "..."
  }
  AdPackage {
    String id PK
    String name
    Int durationDays
    Int impressions
    Int priceCents
    Currency currency
    Boolean active
    DateTime createdAt
    DateTime updatedAt
  }
  AdPurchase {
    String id PK
    String educatorId
    String adPackageId
    AdTargetType targetType
    String testId
    DateTime validUntil
    Int impressionsRemaining
    Int impressionsDelivered
    Currency currency
    DateTime createdAt
    DateTime updatedAt
    DateTime canceledAt
    String canceledReason
    User educator FK
    AdPackage adPackage FK
    rest_3_fields  "..."
  }
  AdImpression {
    String id PK
    String purchaseId
    String educatorId
    String testId
    String viewerUserId
    DateTime createdAt
    AdPurchase purchase FK
    User educator FK
    User viewer FK
  }
  Subscription {
    String id PK
    String tenantId
    String plan
    SubscriptionStatus status
    DateTime startedAt
    DateTime endsAt
    SubscriberKind kind
    String subscriberId
    SubscriptionTier tier
    String providerRef UK
    String customerRef
    DateTime trialEndsAt
    DateTime currentPeriodStart
    DateTime currentPeriodEnd
    Boolean cancelAtPeriodEnd
    rest_4_fields  "..."
  }
  IdempotencyKey {
    String id PK
    String userId
    String route
    String key
    String requestHash
    String status
    Int responseCode
    Json responseBody
    DateTime createdAt
    DateTime expiresAt
  }
  WebhookEvent {
    String id PK
    String provider
    String providerEventId
    Json payload
    DateTime receivedAt
    DateTime processedAt
    String error
  }
  PaymentSettings {
    Int id PK
    String mode
    Boolean iyzicoEnabled
    String iyzicoApiKey
    String iyzicoSecretKey
    String iyzicoBaseUrl
    Boolean googlePayEnabled
    String googlePayMerchantId
    Boolean amazonPayEnabled
    String amazonPayMerchantId
    String companyName
    String companyTaxId
    String companyAddress
    DateTime updatedAt
  }
  LiveSessionTier {
    String id PK
    String label
    Int minParticipants
    Int maxParticipants
    Int priceCents
    Boolean isActive
    Int order
    DateTime createdAt
    DateTime updatedAt
  }
  LiveSession {
    String id PK
    String educatorId
    String tierId
    Int maxParticipants
    Int currentParticipantCount
    String title
    String joinCode UK
    String status
    Int currentQuestionIdx
    Boolean showStats
    DateTime paidAt
    DateTime startedAt
    DateTime endedAt
    Int roundNumber
    String parentSessionId
    rest_6_fields  "..."
  }
  LiveQuestion {
    String id PK
    String sessionId
    String content
    String mediaUrl
    Int order
    DateTime createdAt
    LiveSession session FK
  }
  LiveOption {
    String id PK
    String questionId
    String content
    String mediaUrl
    Boolean isCorrect
    Int order
    LiveQuestion question FK
  }
  LiveParticipant {
    String id PK
    String sessionId
    String userId
    DateTime joinedAt
    DateTime lastSeenAt
    LiveSession session FK
    User user FK
  }
  LiveAnswer {
    String id PK
    String sessionId
    String questionId
    String participantId
    String optionId
    DateTime answeredAt
    LiveQuestion question FK
    LiveOption option FK
    LiveParticipant participant FK
  }
  WorkerPermission {
    String id PK
    String userId UK
    User user FK
    String pages
    DateTime createdAt
    DateTime updatedAt
  }
  EmailProviderConfig {
    String id PK
    String tenantId
    String name
    EmailProviderKind kind
    Int priority
    Boolean isActive
    String fromEmail
    String fromName
    String replyToEmail
    String encryptedSecrets
    DateTime lastSuccessAt
    DateTime lastFailureAt
    String lastFailureReason
    Int dailySentCount
    DateTime dailyResetAt
    rest_5_fields  "..."
  }
  EmailTemplate {
    String id PK
    String tenantId
    String key
    Int version
    String subject
    String htmlPath
    String textPath
    EmailQueue defaultQueue
    Boolean isActive
    String description
    DateTime createdAt
    DateTime updatedAt
    Tenant tenant FK
  }
  EmailLog {
    String id PK
    String tenantId
    String recipientUserId
    String recipientEmail
    UserRole recipientRole
    String templateKey
    Int templateVersion
    EmailQueue queue
    EmailStatus status
    String subject
    String htmlBody
    String textBody
    Json templateData
    String providerConfigId
    EmailProviderKind providerKind
    rest_13_fields  "..."
  }
  EmailEvent {
    String id PK
    String tenantId
    String emailLogId
    EmailEventType eventType
    DateTime occurredAt
    String source
    Json meta
    Tenant tenant FK
    EmailLog emailLog FK
  }
  SuppressedEmail {
    String id PK
    String tenantId
    String email
    SuppressionReason reason
    String source
    String note
    String createdBy
    DateTime createdAt
    DateTime expiresAt
    Tenant tenant FK
  }
  BlockedTerm {
    String id PK
    String tenantId
    String term
    String pattern
    ModerationCategory category
    Int severity
    Boolean isActive
    String createdBy
    DateTime createdAt
    DateTime updatedAt
    Tenant tenant FK
  }
  ModerationResult {
    String id PK
    String tenantId
    String userId
    String entityType
    String entityId
    ModerationProvider provider
    ModerationStatus status
    Float score
    Json scores
    ModerationCategory categories
    String matchedTerms
    String flaggedContent
    String reasonText
    String reviewerNote
    Json rawResponse
    rest_6_fields  "..."
  }
  ModerationViolation {
    String id PK
    String tenantId
    String userId
    String moderationResultId
    ModerationCategory category
    Int severity
    String status
    String entityType
    String entityId
    String adminNote
    String reviewedBy
    DateTime reviewedAt
    DateTime resolvedAt
    DateTime createdAt
    Tenant tenant FK
    rest_1_fields  "..."
  }
  ModerationAction {
    String id PK
    String tenantId
    String userId
    String actorId
    ModerationActionType actionType
    String reason
    Json metadata
    DateTime expiresAt
    DateTime createdAt
    Tenant tenant FK
    User user FK
  }
  EducatorRiskScore {
    String id PK
    String tenantId
    String userId UK
    EducatorRiskLevel riskLevel
    Float computedScore
    Int violationCount
    Int openViolations
    Int highSeverityCount
    DateTime lastViolationAt
    DateTime lastComputedAt
    DateTime createdAt
    DateTime updatedAt
    Tenant tenant FK
    User user FK
  }
  DraftSnapshot {
    String id PK
    String ownerId
    String key
    Json payload
    DateTime updatedAt
    DateTime createdAt
    User owner FK
  }
  AttemptAnomalyEvent {
    String id PK
    String attemptId
    String candidateId
    String type
    Json payload
    DateTime createdAt
    TestAttempt attempt FK
    User candidate FK
  }
  BackupLog {
    String id PK
    String tenantId
    BackupTrigger trigger
    BackupStatus status
    DateTime scheduledAt
    DateTime startedAt
    DateTime finishedAt
    Int durationMs
    BigInt sizeBytes
    String targetPath
    String fileName
    String actorId
    String errorMessage
    String errorStack
    DateTime createdAt
    rest_1_fields  "..."
  }

  Tenant ||--o{ User : "users"
  Tenant ||--o{ ExamTest : "examTests"
  Tenant ||--o{ Purchase : "purchases"
  Tenant ||--o{ AdPurchase : "adPurchases"
  Tenant ||--o{ Subscription : "subscriptions"
  Tenant ||--o{ TestPackage : "testPackages"
  Tenant ||--o{ PackageView : "packageViews"
  Tenant ||--o{ EmailProviderConfig : "emailProviderConfigs"
  Tenant ||--o{ EmailTemplate : "emailTemplates"
  Tenant ||--o{ EmailLog : "emailLogs"
  Tenant ||--o{ EmailEvent : "emailEvents"
  Tenant ||--o{ SuppressedEmail : "suppressedEmails"
  Tenant ||--o{ BlockedTerm : "blockedTerms"
  Tenant ||--o{ ModerationResult : "moderationResults"
  Tenant ||--o{ ModerationViolation : "moderationViolations"
  Tenant ||--o{ ModerationAction : "moderationActions"
  Tenant ||--o{ EducatorRiskScore : "educatorRiskScores"
  User ||--|| Tenant : "tenant"
  User ||--o{ ExamTest : "examTests"
  User ||--o{ Purchase : "purchases"
  User ||--o{ TestAttempt : "attempts"
  User ||--o{ NotificationPreference : "notificationPreferences"
  User ||--o{ DiscountCode : "createdDiscountCodes"
  User ||--o{ Objection : "reportedObjections"
  User ||--o{ Objection : "adminAnsweredObjections"
  User ||--o{ ContractAcceptance : "contractAcceptances"
  User ||--o| UserPreference : "userPreference"
  User ||--o{ AdPurchase : "adPurchases"
  User ||--o{ AdImpression : "adImpressions"
  User ||--o{ AdImpression : "viewedAdImpressions"
  User ||--o| WorkerPermission : "workerPermission"
  User ||--o{ TestPackage : "testPackages"
  User ||--o{ DraftSnapshot : "drafts"
  User ||--o{ AttemptAnomalyEvent : "anomalyEvents"
  User ||--o{ PackageView : "packageViews"
  User ||--o{ LiveSession : "liveSessions"
  User ||--o{ LiveParticipant : "liveParticipations"
  User ||--o{ EmailLog : "emailLogs"
  User ||--o{ UserDevice : "devices"
  User ||--o{ BackupLog : "triggeredBackups"
  User ||--o{ ModerationResult : "moderationResults"
  User ||--o{ ModerationViolation : "moderationViolations"
  User ||--o{ ModerationAction : "moderationActions"
  User ||--o| EducatorRiskScore : "educatorRiskScore"
  UserPreference ||--|| User : "user"
  ExamType ||--o{ TopicExamType : "topics"
  ExamType ||--o{ ExamTest : "tests"
  Topic ||--o| Topic : "parent"
  Topic ||--o{ Topic : "children"
  Topic ||--o{ TopicExamType : "examTypes"
  Topic ||--o{ ExamTest : "tests"
  TopicExamType ||--|| Topic : "topic"
  TopicExamType ||--|| ExamType : "examType"
  ExamTest ||--|| Tenant : "tenant"
  ExamTest ||--o| TestPackage : "package"
  ExamTest ||--o{ ExamQuestion : "questions"
  ExamTest ||--o{ TestAttempt : "attempts"
  ExamTest ||--o| ExamType : "examType"
  ExamTest ||--o| Topic : "topic"
  ExamTest ||--o| User : "educator"
  ExamTest ||--o{ Purchase : "Purchase"
  ExamTest ||--o{ AdPurchase : "adPurchases"
  ExamQuestion ||--|| ExamTest : "test"
  ExamQuestion ||--o{ ExamOption : "options"
  ExamQuestion ||--o{ AttemptAnswer : "answers"
  ExamQuestion ||--o{ Objection : "objections"
  ExamOption ||--|| ExamQuestion : "question"
  ExamOption ||--o{ AttemptAnswer : "selectedBy"
  TestAttempt ||--|| ExamTest : "test"
  TestAttempt ||--|| User : "candidate"
  TestAttempt ||--o{ AttemptAnswer : "answers"
  TestAttempt ||--o{ Objection : "objections"
  TestAttempt ||--o{ AttemptAnomalyEvent : "anomalyEvents"
  AttemptAnswer ||--|| TestAttempt : "attempt"
  AttemptAnswer ||--|| ExamQuestion : "question"
  AttemptAnswer ||--o| ExamOption : "option"
  Purchase ||--|| Tenant : "tenant"
  Purchase ||--|| ExamTest : "test"
  Purchase ||--|| User : "candidate"
  Purchase ||--o| DiscountCode : "discountCode"
  Purchase ||--o| TestPackage : "package"
  TestPackage ||--|| Tenant : "tenant"
  TestPackage ||--o| User : "educator"
  TestPackage ||--o{ ExamTest : "tests"
  TestPackage ||--o{ Purchase : "purchases"
  TestPackage ||--o{ PackageView : "views"
  PackageView ||--|| Tenant : "tenant"
  PackageView ||--|| TestPackage : "package"
  PackageView ||--o| User : "viewer"
  NotificationPreference ||--|| User : "user"
  DiscountCode ||--o| User : "createdBy"
  DiscountCode ||--o{ Purchase : "purchases"
  Objection ||--|| TestAttempt : "attempt"
  Objection ||--|| ExamQuestion : "question"
  Objection ||--|| User : "reporter"
  Objection ||--o| User : "adminAnswerer"
  Contract ||--o{ ContractAcceptance : "acceptances"
  ContractAcceptance ||--|| User : "user"
  ContractAcceptance ||--|| Contract : "contract"
  UserDevice ||--|| User : "user"
  AdPackage ||--o{ AdPurchase : "purchases"
  AdPurchase ||--|| User : "educator"
  AdPurchase ||--|| AdPackage : "adPackage"
  AdPurchase ||--o| ExamTest : "test"
  AdPurchase ||--o{ AdImpression : "impressions"
  AdPurchase ||--|| Tenant : "tenant"
  AdImpression ||--|| AdPurchase : "purchase"
  AdImpression ||--|| User : "educator"
  AdImpression ||--o| User : "viewer"
  Subscription ||--|| Tenant : "tenant"
  LiveSessionTier ||--o{ LiveSession : "sessions"
  LiveSession ||--|| User : "educator"
  LiveSession ||--o| LiveSessionTier : "tier"
  LiveSession ||--o{ LiveQuestion : "questions"
  LiveSession ||--o{ LiveParticipant : "participants"
  LiveSession ||--o| LiveSession : "parent"
  LiveSession ||--o{ LiveSession : "rounds"
  LiveQuestion ||--|| LiveSession : "session"
  LiveQuestion ||--o{ LiveOption : "options"
  LiveQuestion ||--o{ LiveAnswer : "answers"
  LiveOption ||--|| LiveQuestion : "question"
  LiveOption ||--o{ LiveAnswer : "answers"
  LiveParticipant ||--|| LiveSession : "session"
  LiveParticipant ||--|| User : "user"
  LiveParticipant ||--o{ LiveAnswer : "answers"
  LiveAnswer ||--|| LiveQuestion : "question"
  LiveAnswer ||--o| LiveOption : "option"
  LiveAnswer ||--|| LiveParticipant : "participant"
  WorkerPermission ||--|| User : "user"
  EmailProviderConfig ||--|| Tenant : "tenant"
  EmailProviderConfig ||--o{ EmailLog : "emailLogs"
  EmailTemplate ||--|| Tenant : "tenant"
  EmailLog ||--|| Tenant : "tenant"
  EmailLog ||--o| User : "recipient"
  EmailLog ||--o| EmailProviderConfig : "providerConfig"
  EmailLog ||--o{ EmailEvent : "events"
  EmailEvent ||--|| Tenant : "tenant"
  EmailEvent ||--|| EmailLog : "emailLog"
  SuppressedEmail ||--|| Tenant : "tenant"
  BlockedTerm ||--|| Tenant : "tenant"
  ModerationResult ||--|| Tenant : "tenant"
  ModerationResult ||--|| User : "user"
  ModerationViolation ||--|| Tenant : "tenant"
  ModerationViolation ||--|| User : "user"
  ModerationAction ||--|| Tenant : "tenant"
  ModerationAction ||--|| User : "user"
  EducatorRiskScore ||--|| Tenant : "tenant"
  EducatorRiskScore ||--|| User : "user"
  DraftSnapshot ||--|| User : "owner"
  AttemptAnomalyEvent ||--|| TestAttempt : "attempt"
  AttemptAnomalyEvent ||--|| User : "candidate"
  BackupLog ||--o| User : "actor"
```

## Modeller

| Model | Alan sayısı | İlişki sayısı |
|---|---|---|
| Tenant | 6 | 17 |
| User | 50 | 27 |
| UserPreference | 6 | 1 |
| ExamType | 8 | 2 |
| Topic | 8 | 4 |
| TopicExamType | 4 | 2 |
| ExamTest | 29 | 9 |
| ExamQuestion | 12 | 4 |
| ExamOption | 10 | 2 |
| TestAttempt | 17 | 5 |
| TestStats | 6 | 0 |
| AttemptAnswer | 10 | 3 |
| Purchase | 22 | 5 |
| TestPackage | 15 | 5 |
| PackageView | 12 | 3 |
| Follow | 7 | 0 |
| NotificationPreference | 9 | 1 |
| AuditLog | 14 | 0 |
| DiscountCode | 12 | 2 |
| Objection | 18 | 4 |
| RefundRequest | 18 | 0 |
| Review | 10 | 0 |
| Contract | 9 | 1 |
| ContractAcceptance | 8 | 2 |
| UserDevice | 11 | 1 |
| AdminSettings | 49 | 0 |
| CommissionRateHistory | 5 | 0 |
| SiteSettings | 21 | 0 |
| AdPackage | 9 | 1 |
| AdPurchase | 18 | 5 |
| AdImpression | 9 | 3 |
| Subscription | 19 | 1 |
| IdempotencyKey | 10 | 0 |
| WebhookEvent | 7 | 0 |
| PaymentSettings | 14 | 0 |
| LiveSessionTier | 9 | 1 |
| LiveSession | 21 | 6 |
| LiveQuestion | 7 | 3 |
| LiveOption | 7 | 2 |
| LiveParticipant | 7 | 3 |
| LiveAnswer | 9 | 3 |
| WorkerPermission | 6 | 1 |
| EmailProviderConfig | 20 | 2 |
| EmailTemplate | 13 | 1 |
| EmailLog | 28 | 4 |
| EmailEvent | 9 | 2 |
| SuppressedEmail | 10 | 1 |
| BlockedTerm | 11 | 1 |
| ModerationResult | 21 | 2 |
| ModerationViolation | 16 | 2 |
| ModerationAction | 11 | 2 |
| EducatorRiskScore | 14 | 2 |
| DraftSnapshot | 7 | 1 |
| AttemptAnomalyEvent | 8 | 2 |
| BackupLog | 16 | 1 |

## Enum'lar

AdTargetType, AttemptStatus, AuditAction, BackupStatus, BackupTrigger, ContractType, Currency, EducatorRiskLevel, EmailEventType, EmailProviderKind, EmailQueue, EmailStatus, FollowType, ModerationActionType, ModerationCategory, ModerationProvider, ModerationStatus, ObjectionStatus, PurchaseStatus, RefundStatus, SubscriberKind, SubscriptionStatus, SubscriptionTier, SuppressionReason, TestStatus, UserRole, UserStatus

---

*Üretim tarihi: 2026-05-27T20:10:06.927Z*
