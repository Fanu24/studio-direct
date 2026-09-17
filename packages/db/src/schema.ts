import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  domain: text("domain"),
});

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  nameNorm: text("name_norm").notNull(),
  domain: text("domain"),
  logoUrl: text("logo_url"),
  careerUrl: text("career_url"),
  atsType: text("ats_type"),
  atsSlug: text("ats_slug"),
  listed: integer("listed").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const jobs = sqliteTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    companyId: text("company_id").notNull(),
    canonicalKey: text("canonical_key").notNull(),
    title: text("title").notNull(),
    titleNorm: text("title_norm").notNull(),
    slug: text("slug").notNull(),
    location: text("location"),
    remote: text("remote").notNull(),
    descriptionHtml: text("description_html").notNull(),
    applyUrl: text("apply_url").notNull(),
    salaryText: text("salary_text"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    source: text("source").notNull().default("career_page"),
    externalId: text("external_id"),
    featuredUntil: text("featured_until"),
    highlight: integer("highlight").notNull().default(0),
    listingLogoUrl: text('listing_logo_url'),
    highlightColor: text('highlight_color'),
    expiresAt: text('expires_at'),
    exclusivity: text("exclusivity").notNull().default("unknown"),
    seenOnIndeed: integer("seen_on_indeed").notNull().default(0),
    postedAt: text("posted_at"),
    listed: integer("listed").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    tenantCanonicalUnique: uniqueIndex("idx_jobs_tenant_canonical_unique").on(
      table.tenantId,
      table.canonicalKey,
    ),
    tenantSlugUnique: uniqueIndex("idx_jobs_tenant_slug_unique").on(
      table.tenantId,
      table.slug,
    ),
  }),
);

export const jobSightings = sqliteTable("job_sightings", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url").notNull(),
  seenAt: text("seen_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").notNull(),
  emailVerified: integer("email_verified").notNull().default(0),
  image: text("image"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: text("expires_at").notNull(),
  token: text("token").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: text("access_token_expires_at"),
  refreshTokenExpiresAt: text("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name"),
  headline: text("headline"),
  location: text("location"),
  timezone: text("timezone"),
  targetRole: text("target_role"),
  seniority: text("seniority"),
  remotePref: text("remote_pref"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  workAuthText: text("work_auth_text"),
  completeness: integer("completeness").notNull().default(0),
  talentPoolOptIn: integer("talent_pool_opt_in").notNull().default(0),
  talentPoolOptInAt: text("talent_pool_opt_in_at"),
  talentPoolOptOutAt: text("talent_pool_opt_out_at"),
  cvR2Key: text("cv_r2_key"),
});

export const experienceEntries = sqliteTable("experience_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  description: text("description"),
});

export const profileSkills = sqliteTable("profile_skills", {
  userId: text("user_id").notNull(),
  skill: text("skill").notNull(),
});

export const unlocks = sqliteTable("unlocks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  jobId: text("job_id").notNull(),
  weekId: text("week_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  userId: text("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeStatus: text("stripe_status"),
  periodEnd: text("period_end"),
});

export const consentEvents = sqliteTable("consent_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull(),
});

export const crawlRuns = sqliteTable("crawl_runs", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  ok: integer("ok").notNull().default(0),
  statsJson: text("stats_json").notNull().default("{}"),
});

export const tags = sqliteTable("tags", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
});

export const jobTags = sqliteTable("job_tags", {
  jobId: text("job_id").notNull(),
  tagSlug: text("tag_slug").notNull(),
});

export const locations = sqliteTable("locations", {
  slug: text("slug").primaryKey(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
});

export const jobLocations = sqliteTable("job_locations", {
  jobId: text("job_id").notNull(),
  locationSlug: text("location_slug").notNull(),
});

export const benefits = sqliteTable("benefits", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
});

export const jobBenefits = sqliteTable("job_benefits", {
  jobId: text("job_id").notNull(),
  benefitSlug: text("benefit_slug").notNull(),
});

export const salaryRollups = sqliteTable("salary_rollups", {
  dimension: text("dimension").notNull(),
  slug: text("slug").notNull(),
  avg: integer("avg").notNull(),
  min: integer("min").notNull(),
  max: integer("max").notNull(),
  jobCount30d: integer("job_count_30d").notNull(),
  computedAt: text("computed_at").notNull(),
});

export const jobApplications = sqliteTable("job_applications", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  jobId: text("job_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  profileUrl: text("profile_url"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});
