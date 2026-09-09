type ApplyFormProps = {
  jobId: string;
  next: string;
  sent?: boolean;
  error?: boolean;
};

export function JobApplyForm({ jobId, next, sent, error }: ApplyFormProps) {
  if (sent) {
    return (
      <p className="apply-form__ok" role="status">
        Application received. We stored it against this listing on Nodework and did not
        hand your profile to the studio.
      </p>
    );
  }

  return (
    <form action="/api/apply" className="apply-form" method="post">
      <input name="jobId" type="hidden" value={jobId} />
      <input name="next" type="hidden" value={next} />
      <p aria-hidden="true" className="visually-hidden">
        <label>
          Company website
          <input autoComplete="off" name="company_website" tabIndex={-1} />
        </label>
      </p>
      {error ? (
        <p className="apply-form__err" role="alert">
          Check your name and email, then submit again.
        </p>
      ) : null}
      <label htmlFor="apply-name">
        <span>Full name</span>
        <input autoComplete="name" id="apply-name" name="name" required />
      </label>
      <label htmlFor="apply-email">
        <span>Email</span>
        <input autoComplete="email" id="apply-email" name="email" required type="email" />
      </label>
      <label htmlFor="apply-url">
        <span>Portfolio or LinkedIn</span>
        <input
          autoComplete="url"
          id="apply-url"
          name="profileUrl"
          placeholder="https://"
          type="url"
        />
      </label>
      <label htmlFor="apply-note">
        <span>Note</span>
        <textarea id="apply-note" name="note" rows={5} />
      </label>
      <button className="button button--primary button--block" type="submit">
        Submit application
      </button>
    </form>
  );
}
