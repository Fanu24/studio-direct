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
