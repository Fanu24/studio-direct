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
        <p className="notice notice--danger apply-form__err" role="alert">
          Check your name and email, then submit again.
        </p>
      ) : null}
      <div className="field">
        <label className="field__label" htmlFor="apply-name">
          Full name
        </label>
        <input
          autoComplete="name"
          className="field__input"
          id="apply-name"
          name="name"
          required
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="apply-email">
          Email
        </label>
        <input
          autoComplete="email"
          className="field__input"
          id="apply-email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="apply-url">
          Portfolio or LinkedIn <span className="field__optional">(optional)</span>
        </label>
        <input
          autoComplete="url"
          className="field__input"
          id="apply-url"
          name="profileUrl"
          placeholder="https://"
          type="url"
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="apply-note">
          Note <span className="field__optional">(optional)</span>
        </label>
        <textarea className="field__input" id="apply-note" name="note" rows={5} />
      </div>
      <button className="button button--primary button--block" type="submit">
        Submit application
      </button>
    </form>
  );
}
