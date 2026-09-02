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
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
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
