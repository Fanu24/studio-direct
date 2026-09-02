import type { ReactNode } from "react";

import type { JobListItem } from "../../lib/jobs/queries";
import { JobCardGrid } from "./job-card";

export function JobHubList({
  emptyMessage,
  emptyActions,
  jobs,
}: {
  emptyMessage: string;
  emptyActions?: ReactNode;
  jobs: JobListItem[];
}) {
  return (
    <JobCardGrid
      emptyActions={emptyActions}
      emptyMessage={emptyMessage}
      headingLevel="h2"
      jobs={jobs}
    />
  );
}
