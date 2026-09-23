import {index, integer, primaryKey, real, sqliteTable, text} from 'drizzle-orm/sqlite-core';

// SQL migrations also enforce cross-taxonomy uniqueness and JSON/check constraints.
export const featureFlags = sqliteTable('feature_flags', {
  tenantId: text('tenant_id').notNull(), name: text('name').notNull(), enabled: integer('enabled').notNull().default(0),
  updatedAt: text('updated_at').notNull(), updatedBy: text('updated_by'),
}, table => ({key: primaryKey({columns: [table.tenantId, table.name]})}));
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(), slug: text('slug').notNull().unique(), name: text('name').notNull(), category: text('category').notNull(),
  aliasesJson: text('aliases_json').notNull().default('[]'), status: text('status').notNull().default('active'),
  requestedBy: text('requested_by'), createdAt: text('created_at').notNull(),
}, table => ({statusName: index('idx_skills_status_name').on(table.status, table.name)}));
export const referenceCountries = sqliteTable('reference_countries', {
  code: text('code').primaryKey(), name: text('name').notNull(), continent: text('continent').notNull(),
});
export const referenceCities = sqliteTable('reference_cities', {
  id: integer('id').primaryKey(), name: text('name').notNull(), searchName: text('search_name').notNull(), region: text('region').notNull(),
  countryCode: text('country_code').notNull(), latitude: real('latitude').notNull(), longitude: real('longitude').notNull(),
  timezone: text('timezone').notNull(), population: integer('population').notNull().default(0),
}, table => ({search: index('idx_reference_city_search').on(table.searchName), country: index('idx_reference_city_country').on(table.countryCode, table.population)}));
export const referenceLanguages = sqliteTable('reference_languages', {
  code: text('code').primaryKey(), name: text('name').notNull(), nativeName: text('native_name').notNull(),
});
export const regions = sqliteTable('regions', {
  id: text('id').primaryKey(), name: text('name').notNull().unique(), type: text('type').notNull(), countryCodesJson: text('country_codes_json').notNull(),
});
export const jobRoles = sqliteTable('job_roles', {
  id: text('id').primaryKey(), name: text('name').notNull(), slug: text('slug').notNull().unique(),
  aliasesJson: text('aliases_json').notNull().default('[]'), patternsJson: text('patterns_json').notNull().default('[]'),
});
export const fxRates = sqliteTable('fx_rates', {
  currency: text('currency').primaryKey(), rateToUsd: real('rate_to_usd').notNull(), updatedAt: text('updated_at').notNull(), source: text('source').notNull(),
});
export const referenceImports = sqliteTable('reference_imports', {
  dataset: text('dataset').primaryKey(), sourceUrl: text('source_url').notNull(), sha256: text('sha256').notNull(), rowCount: integer('row_count').notNull(), importedAt: text('imported_at').notNull(),
});
export const jobSkills = sqliteTable('job_skills', {
  jobId:text('job_id').notNull(),skillId:text('skill_id').notNull(),kind:text('kind').notNull(),
},table=>({key:primaryKey({columns:[table.jobId,table.skillId]})}));
export const jobLanguageRequirements = sqliteTable('job_language_requirements', {
  jobId:text('job_id').notNull(),languageCode:text('language_code').notNull(),level:text('level').notNull(),kind:text('kind').notNull(),
},table=>({key:primaryKey({columns:[table.jobId,table.languageCode]})}));
export const jobCities = sqliteTable('job_cities', {
  jobId:text('job_id').notNull(),cityId:integer('city_id').notNull(),
},table=>({key:primaryKey({columns:[table.jobId,table.cityId]})}));
export const jobRemoteEligibility = sqliteTable('job_remote_eligibility', {
  jobId:text('job_id').primaryKey(),mode:text('mode').notNull(),rulesJson:text('rules_json').notNull(),
});
export const nativeListingDetails = sqliteTable('native_listing_details', {
  jobId:text('job_id').primaryKey(),inputJson:text('input_json').notNull(),addonsJson:text('addons_json').notNull(),updatedAt:text('updated_at').notNull(),
});
export const companyClaimOrders = sqliteTable('company_claim_orders', {
  id:text('id').primaryKey(),tenantId:text('tenant_id').notNull(),userId:text('user_id'),companyId:text('company_id').notNull(),companyUrl:text('company_url').notNull(),
  totalCents:integer('total_cents').notNull(),currency:text('currency').notNull().default('usd'),status:text('status').notNull().default('pending'),
  stripeSessionId:text('stripe_session_id').unique(),stripePaymentIntentId:text('stripe_payment_intent_id'),createdAt:text('created_at').notNull(),paidAt:text('paid_at'),
});
export const companyPurchaseEntitlements = sqliteTable('company_purchase_entitlements', {
  id:text('id').primaryKey(),tenantId:text('tenant_id').notNull(),userId:text('user_id'),companyId:text('company_id').notNull(),kind:text('kind').notNull(),sourceId:text('source_id').notNull(),
  stripePaymentIntentId:text('stripe_payment_intent_id'),status:text('status').notNull().default('active'),createdAt:text('created_at').notNull(),revokedAt:text('revoked_at'),
});
export const companyClaims = sqliteTable('company_claims', {
  id:text('id').primaryKey(),tenantId:text('tenant_id').notNull(),userId:text('user_id'),companyId:text('company_id').notNull(),entitlementId:text('entitlement_id').notNull().unique(),
  status:text('status').notNull().default('pending'),verifiedBy:text('verified_by'),verificationMethod:text('verification_method'),createdAt:text('created_at').notNull(),verifiedAt:text('verified_at'),reason:text('reason'),
});
export const productBillingEvents = sqliteTable('product_billing_events', {
  id:text('id').primaryKey(),sourceId:text('source_id').notNull(),type:text('type').notNull(),processedAt:text('processed_at').notNull(),
});

export const fxRefreshState=sqliteTable('fx_refresh_state',{
  id:integer('id').primaryKey(),nextAttemptAt:text('next_attempt_at').notNull(),leaseToken:text('lease_token').notNull(),lastSuccessAt:text('last_success_at'),lastError:text('last_error'),
});

// Product phases 2–7. SQL migrations remain authoritative for foreign keys and conditional indexes.

export const candidateSkills=sqliteTable('candidate_skills',{
  userId:text('user_id').notNull(),
  skillId:text('skill_id').notNull()
},table=>({key:primaryKey({columns:[table.userId,table.skillId]})}));

export const candidateLanguages=sqliteTable('candidate_languages',{
  userId:text('user_id').notNull(),
  languageCode:text('language_code').notNull(),
  level:text('level').notNull()
},table=>({key:primaryKey({columns:[table.userId,table.languageCode]})}));

export const candidateLinks=sqliteTable('candidate_links',{
  userId:text('user_id').notNull(),
  kind:text('kind').notNull(),
  url:text('url').notNull()
},table=>({key:primaryKey({columns:[table.userId,table.kind]})}));

export const notificationPreferences=sqliteTable('notification_preferences',{
  userId:text('user_id').notNull(),
  kind:text('kind').notNull(),
  emailEnabled:integer('email_enabled').notNull().default(1),
  inAppEnabled:integer('in_app_enabled').notNull().default(1)
},table=>({key:primaryKey({columns:[table.userId,table.kind]})}));

export const candidateSubscriptions=sqliteTable('candidate_subscriptions',{
  userId:text('user_id').primaryKey(),
  plan:text('plan').notNull(),
  status:text('status').notNull(),
  providerRef:text('provider_ref'),
  customerId:text('customer_id'),
  renewsAt:text('renews_at').notNull(),
  cancelAtPeriodEnd:integer('cancel_at_period_end').notNull().default(0),
  updatedAt:text('updated_at').notNull()
});

export const applicationStageHistory=sqliteTable('application_stage_history',{
  id:text('id').primaryKey(),
  applicationId:text('application_id').notNull(),
  stage:text('stage').notNull(),
  changedBy:text('changed_by'),
  createdAt:text('created_at').notNull()
});

export const authenticatedApplications=sqliteTable('authenticated_applications',{
  jobId:text('job_id').notNull(),
  userId:text('user_id').notNull(),
  applicationId:text('application_id')
},table=>({key:primaryKey({columns:[table.jobId,table.userId]})}));

export const earlyAccessReminders=sqliteTable('early_access_reminders',{
  jobId:text('job_id').notNull(),
  userId:text('user_id').notNull(),
  createdAt:text('created_at').notNull(),
  notifiedAt:text('notified_at')
},table=>({key:primaryKey({columns:[table.jobId,table.userId]})}));

export const productInvitations=sqliteTable('product_invitations',{
  id:text('id').primaryKey(),
  companyId:text('company_id').notNull(),
  jobId:text('job_id').notNull(),
  candidateId:text('candidate_id').notNull(),
  sentBy:text('sent_by'),
  source:text('source').notNull(),
  message:text('message').notNull().default(""),
  sentAt:text('sent_at').notNull(),
  status:text('status').notNull().default("sent"),
  quotaPeriod:text('quota_period'),
  packId:text('pack_id')
});

export const jobEvents=sqliteTable('job_events',{
  id:text('id').primaryKey(),
  jobId:text('job_id').notNull(),
  type:text('type').notNull(),
  referrerGroup:text('referrer_group'),
  sessionHash:text('session_hash'),
  createdAt:text('created_at').notNull()
});

export const productOrders=sqliteTable('product_orders',{
  id:text('id').primaryKey(),
  tenantId:text('tenant_id').notNull(),
  userId:text('user_id'),
  companyId:text('company_id'),
  kind:text('kind').notNull(),
  choice:text('choice').notNull(),
  payloadJson:text('payload_json').notNull().default("{}"),
  totalCents:integer('total_cents').notNull(),
  currency:text('currency').notNull().default("usd"),
  status:text('status').notNull().default("pending"),
  stripeSessionId:text('stripe_session_id'),
  stripeSubscriptionId:text('stripe_subscription_id'),
  stripeCustomerId:text('stripe_customer_id'),
  stripePaymentIntentId:text('stripe_payment_intent_id'),
  createdAt:text('created_at').notNull(),
  paidAt:text('paid_at')
});

export const companyMembers=sqliteTable('company_members',{
  companyId:text('company_id').notNull(),
  userId:text('user_id').notNull(),
  role:text('role').notNull(),
  createdAt:text('created_at').notNull()
},table=>({key:primaryKey({columns:[table.companyId,table.userId]})}));

export const companyTeamInvitations=sqliteTable('company_team_invitations',{
  id:text('id').primaryKey(),
  companyId:text('company_id').notNull(),
  email:text('email').notNull(),
  invitedBy:text('invited_by'),
  status:text('status').notNull().default("pending"),
  createdAt:text('created_at').notNull(),
  expiresAt:text('expires_at').notNull()
});

export const companyPlans=sqliteTable('company_plans',{
  companyId:text('company_id').primaryKey(),
  ownerUserId:text('owner_user_id'),
  tier:text('tier').notNull(),
  providerRef:text('provider_ref').notNull(),
  customerId:text('customer_id'),
  status:text('status').notNull(),
  periodStart:text('period_start').notNull(),
  renewsAt:text('renews_at').notNull(),
  cancelAtPeriodEnd:integer('cancel_at_period_end').notNull().default(0),
  updatedAt:text('updated_at').notNull()
});

export const companyPlanPeriods=sqliteTable('company_plan_periods',{
  id:text('id').primaryKey(),
  companyId:text('company_id').notNull(),
  providerRef:text('provider_ref').notNull(),
  tier:text('tier').notNull(),
  granted:integer('granted').notNull(),
  periodStart:text('period_start').notNull(),
  expiresAt:text('expires_at').notNull(),
  paymentIntentId:text('payment_intent_id'),
  revoked:integer('revoked').notNull().default(0),
  createdAt:text('created_at').notNull()
});

export const planCreditReservations=sqliteTable('plan_credit_reservations',{
  orderId:text('order_id').primaryKey(),
  companyId:text('company_id').notNull(),
  periodId:text('period_id').notNull(),
  kind:text('kind').notNull(),
  status:text('status').notNull().default("held"),
  createdAt:text('created_at').notNull()
});

export const creditLedger=sqliteTable('credit_ledger',{
  id:text('id').primaryKey(),
  companyId:text('company_id').notNull(),
  periodId:text('period_id').notNull(),
  jobId:text('job_id'),
  orderId:text('order_id'),
  delta:integer('delta').notNull(),
  reason:text('reason').notNull(),
  createdAt:text('created_at').notNull()
});

export const productSubscriptionInvoices=sqliteTable('product_subscription_invoices',{
  id:text('id').primaryKey(),
  orderId:text('order_id').notNull(),
  providerRef:text('provider_ref').notNull(),
  paymentIntentId:text('payment_intent_id'),
  periodStart:text('period_start').notNull(),
  periodEnd:text('period_end').notNull(),
  amountPaid:integer('amount_paid').notNull(),
  hostedUrl:text('hosted_url'),
  revoked:integer('revoked').notNull().default(0)
});

export const candidateVerificationRequests=sqliteTable('candidate_verification_requests',{
  id:text('id').primaryKey(),
  userId:text('user_id'),
  orderId:text('order_id').notNull(),
  status:text('status').notNull().default("awaiting_evidence"),
  evidenceKey:text('evidence_key'),
  submittedAt:text('submitted_at'),
  reviewedBy:text('reviewed_by'),
  reviewedAt:text('reviewed_at'),
  reason:text('reason'),
  createdAt:text('created_at').notNull()
});

export const talentInvitePacks=sqliteTable('talent_invite_packs',{
  id:text('id').primaryKey(),
  companyId:text('company_id').notNull(),
  quantity:integer('quantity').notNull(),
  used:integer('used').notNull().default(0),
  revoked:integer('revoked').notNull().default(0),
  createdAt:text('created_at').notNull()
});

export const productAdminAudit=sqliteTable('product_admin_audit',{
  id:text('id').primaryKey(),
  tenantId:text('tenant_id').notNull(),
  actorId:text('actor_id'),
  action:text('action').notNull(),
  subjectId:text('subject_id').notNull(),
  reason:text('reason').notNull(),
  createdAt:text('created_at').notNull()
});

export const featuredMembers=sqliteTable('featured_members',{
  date:text('date').primaryKey(),
  userId:text('user_id'),
  selectedAt:text('selected_at').notNull(),
  source:text('source').notNull()
});

export const profileViews=sqliteTable('profile_views',{
  id:text('id').primaryKey(),
  candidateId:text('candidate_id').notNull(),
  viewerCompanyId:text('viewer_company_id'),
  sessionHash:text('session_hash').notNull(),
  viewedAt:text('viewed_at').notNull()
});

export const productDailyRuns=sqliteTable('product_daily_runs',{
  kind:text('kind').notNull(),
  date:text('date').notNull(),
  finishedAt:text('finished_at').notNull()
},table=>({key:primaryKey({columns:[table.kind,table.date]})}));

export const productOperationsLeases=sqliteTable('product_operations_leases',{
  kind:text('kind').primaryKey(),
  leaseUntil:text('lease_until').notNull(),
  token:text('token').notNull()
});

export const companyReviews=sqliteTable('company_reviews',{
  id:text('id').primaryKey(),
  tenantId:text('tenant_id').notNull(),
  companyId:text('company_id').notNull(),
  userId:text('user_id'),
  overall:integer('overall').notNull(),
  paidOnTime:integer('paid_on_time').notNull(),
  transparentProcess:integer('transparent_process').notNull(),
  wouldWorkAgain:integer('would_work_again').notNull(),
  relationship:text('relationship').notNull(),
  body:text('body').notNull(),
  isAnonymous:integer('is_anonymous').notNull().default(0),
  status:text('status').notNull().default("pending"),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull(),
  publishedAt:text('published_at')
});

export const reviewWorkEvidence=sqliteTable('review_work_evidence',{
  reviewId:text('review_id').primaryKey(),
  userId:text('user_id'),
  r2Key:text('r2_key').notNull(),
  status:text('status').notNull().default("pending"),
  reviewedBy:text('reviewed_by'),
  reviewedAt:text('reviewed_at'),
  reason:text('reason')
});

export const reviewResponses=sqliteTable('review_responses',{
  reviewId:text('review_id').primaryKey(),
  companyId:text('company_id').notNull(),
  userId:text('user_id'),
  body:text('body').notNull(),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull()
});

export const reviewReports=sqliteTable('review_reports',{
  id:text('id').primaryKey(),
  reviewId:text('review_id').notNull(),
  userId:text('user_id'),
  reason:text('reason').notNull(),
  status:text('status').notNull().default("pending"),
  createdAt:text('created_at').notNull()
});

export const reviewModerationHistory=sqliteTable('review_moderation_history',{
  id:text('id').primaryKey(),
  reviewId:text('review_id').notNull(),
  adminId:text('admin_id'),
  action:text('action').notNull(),
  reason:text('reason').notNull(),
  createdAt:text('created_at').notNull()
});

export const salaryStats=sqliteTable('salary_stats',{
  roleSlug:text('role_slug').notNull(),
  locationSlug:text('location_slug').notNull(),
  asOf:text('as_of').notNull(),
  statsJson:text('stats_json').notNull()
},table=>({key:primaryKey({columns:[table.roleSlug,table.locationSlug,table.asOf]})}));

export const socialOutbox=sqliteTable('social_outbox',{
  id:text('id').primaryKey(),
  jobId:text('job_id').notNull(),
  channel:text('channel').notNull(),
  status:text('status').notNull().default("pending"),
  attempts:integer('attempts').notNull().default(0),
  retryAt:text('retry_at'),
  leaseToken:text('lease_token'),
  leaseUntil:text('lease_until'),
  providerId:text('provider_id'),
  lastError:text('last_error'),
  createdAt:text('created_at').notNull(),
  sentAt:text('sent_at')
});

export const newsletterSubscribers=sqliteTable('newsletter_subscribers',{
  id:text('id').primaryKey(),
  userId:text('user_id'),
  email:text('email').notNull(),
  active:integer('active').notNull().default(1),
  unsubscribeToken:text('unsubscribe_token').notNull(),
  createdAt:text('created_at').notNull()
});

export const newsletterEditions=sqliteTable('newsletter_editions',{
  id:text('id').primaryKey(),
  tenantId:text('tenant_id').notNull(),
  weekStart:text('week_start').notNull(),
  createdAt:text('created_at').notNull()
});

export const newsletterJobs=sqliteTable('newsletter_jobs',{
  editionId:text('edition_id').notNull(),
  jobId:text('job_id').notNull(),
  companyId:text('company_id').notNull(),
  benefitMonth:text('benefit_month')
},table=>({key:primaryKey({columns:[table.editionId,table.jobId]})}));

export const newsletterDeliveries=sqliteTable('newsletter_deliveries',{
  editionId:text('edition_id').notNull(),
  subscriberId:text('subscriber_id').notNull(),
  status:text('status').notNull().default("pending"),
  attempts:integer('attempts').notNull().default(0),
  retryAt:text('retry_at'),
  leaseToken:text('lease_token'),
  leaseUntil:text('lease_until'),
  sentAt:text('sent_at'),
  lastError:text('last_error')
},table=>({key:primaryKey({columns:[table.editionId,table.subscriberId]})}));

export const companyAtsIntegrations=sqliteTable('company_ats_integrations',{
  id:text('id').primaryKey(),
  tenantId:text('tenant_id').notNull(),
  companyId:text('company_id').notNull(),
  provider:text('provider').notNull(),
  board:text('board').notNull(),
  mappingJson:text('mapping_json').notNull(),
  enabled:integer('enabled').notNull().default(1),
  confidential:integer('confidential').notNull().default(0),
  lastAttemptAt:text('last_attempt_at'),
  lastSuccessAt:text('last_success_at'),
  lastError:text('last_error'),
  leaseToken:text('lease_token'),
  leaseUntil:text('lease_until'),
  createdAt:text('created_at').notNull()
});

export const companyAtsJobs=sqliteTable('company_ats_jobs',{
  id:text('id').primaryKey(),
  integrationId:text('integration_id').notNull(),
  externalId:text('external_id').notNull(),
  title:text('title').notNull(),
  sourceUrl:text('source_url').notNull(),
  rawJson:text('raw_json').notNull(),
  postingJson:text('posting_json'),
  validationError:text('validation_error'),
  status:text('status').notNull().default("draft"),
  jobId:text('job_id'),
  orderId:text('order_id'),
  seenAt:text('seen_at').notNull(),
  updatedAt:text('updated_at').notNull()
});

export const supportTickets=sqliteTable('support_tickets',{
  dueAt:text('due_at'),firstResponseAt:text('first_response_at'),
  id:text('id').primaryKey(),
  tenantId:text('tenant_id').notNull(),
  userId:text('user_id'),
  companyId:text('company_id'),
  subject:text('subject').notNull(),
  body:text('body').notNull(),
  priority:integer('priority').notNull().default(0),
  status:text('status').notNull().default("open"),
  createdAt:text('created_at').notNull(),
  updatedAt:text('updated_at').notNull()
});

export const supportReplies=sqliteTable('support_replies',{
  id:text('id').primaryKey(),
  ticketId:text('ticket_id').notNull(),
  userId:text('user_id'),
  body:text('body').notNull(),
  createdAt:text('created_at').notNull()
});

export const candidateShortlists=sqliteTable('candidate_shortlists',{
  jobId:text('job_id').notNull(),
  candidateId:text('candidate_id').notNull(),
  date:text('date').notNull(),
  score:integer('score').notNull(),
  rank:integer('rank').notNull()
},table=>({key:primaryKey({columns:[table.jobId,table.candidateId,table.date]})}));

export const jobExtensions=sqliteTable('job_extensions',{
  orderId:text('order_id').primaryKey(),
  jobId:text('job_id').notNull(),
  baseExpiry:text('base_expiry').notNull(),
  createdAt:text('created_at').notNull(),
  days:integer('days').notNull().default(30),
  revoked:integer('revoked').notNull().default(0)
});

export const jobViewSessions=sqliteTable('job_view_sessions',{
  id:text('id').primaryKey(),
  createdAt:text('created_at').notNull()
});

export const productRateLimits=sqliteTable('product_rate_limits',{userId:text('user_id').notNull(),kind:text('kind').notNull(),window:text('window').notNull(),hits:integer('hits').notNull().default(0)},t=>({key:primaryKey({columns:[t.userId,t.kind,t.window]})}));
