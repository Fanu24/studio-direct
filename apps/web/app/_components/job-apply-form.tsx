type ApplyFormProps = {
  jobId: string;
  next: string;
  sent?: boolean;
  error?: boolean;
  withdrawn?: boolean;
  email: string;
  name?: string;
};

export function JobApplyForm({ jobId, next, sent, error, withdrawn, email, name }: ApplyFormProps) {
  if (withdrawn) return <p role="status">You withdrew this application. It has not been submitted again. <a href="/applications">View your applications</a></p>;
  if (sent) {
    return (
      <p className="apply-form__ok" role="status">
        Application received. The employer can now review it in their dashboard.
      </p>
    );
  }

  return (
    <form action="/api/apply" className="apply-form" method="post" encType="multipart/form-data">
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
          Check the application details and PDF (maximum 5 MB). This job may no longer accept applications.
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
          defaultValue={name}
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
          value={email}
          readOnly
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
      <p>Your verified account email will be shared with this employer.</p>
      <label>CV for this application (PDF, maximum 5 MB)<input type="file" name="cv" accept="application/pdf"/></label>
      <label><input name="share_application" type="checkbox" value="1" required/> I agree to share this application and my contact details with the employer for this role.</label>
      <button className="button button--primary button--block" type="submit">
        Submit application
      </button>
    </form>
  );
}
