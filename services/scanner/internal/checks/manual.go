package checks

import "github.com/akshaydubey05/seaworthy/scanner/internal/model"

func BuildManualChecks(c *Context) []model.ManualCheck {
	var out []model.ManualCheck
	seen := map[string]bool{}
	add := func(id, title, why string) {
		if !seen[id] {
			seen[id] = true
			out = append(out, model.ManualCheck{ID: id, Title: title, Why: why})
		}
	}

	if supabaseUsageRe.MatchString(c.HTML) {
		add("M-01", "Verify Supabase Row Level Security", "Supabase is referenced publicly. Enable RLS on every table and test reads/writes with the anon key.")
	}
	if firebaseRe.MatchString(c.HTML) {
		add("M-02", "Verify Firebase security rules", "A Firebase config is public. Confirm Firestore/Storage rules deny unauthenticated reads and writes.")
	}
	if c.HasPaymentScript {
		add("M-03", "Verify Stripe webhook signatures", "Stripe.js is loaded. Confirm webhooks verify the Stripe-Signature header and reject unsigned events.")
	}
	if c.HasPasswordForm {
		add("M-04", "Review login rate limiting and sessions", "A password field is present. Check login throttling, lockout, MFA options, and session cookie lifetime.")
	}
	if c.HasForms {
		add("M-05", "Check CSRF protection on forms", "Forms are present. Confirm state-changing requests require a CSRF token or SameSite cookies.")
	}
	if fileInputRe.MatchString(c.HTML) {
		add("M-06", "Review file upload handling", "An upload control is present. Validate type/size server-side, store outside the web root, and scan files.")
	}
	if adminPathRe.MatchString(c.HTML) {
		add("M-07", "Confirm admin/debug routes require auth", "Links to admin or debug paths are public. Verify strong authentication and authorization on every route.")
	}
	if redirectParamRe.MatchString(c.URL.RawQuery) {
		add("M-08", "Test redirect parameters for open redirects", "The URL has a redirect-style parameter. Confirm targets are allowlisted and external URLs are rejected.")
	}

	return out
}
