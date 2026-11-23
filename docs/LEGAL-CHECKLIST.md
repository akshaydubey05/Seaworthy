# Legal checklist (plain language, not legal advice)

This is a practical checklist for a solo founder. It is **not legal advice**.

## Before public launch

- [ ] Set env vars: company/name, contact email, security email, jurisdiction.
- [ ] Read `/terms`, `/privacy`, `/security` and remove anything untrue for your product.
- [ ] Keep the disclaimer visible: best-effort automated review, not pentest/certification.
- [ ] Add a visible way to contact you (email is enough at V1).
- [ ] Only scan targets users submit; don't scan random sites without permission.
- [ ] Don't store secrets from scan evidence longer than needed; redact where possible.

## Before charging money

- [ ] Have Terms/Privacy reviewed by a lawyer in your jurisdiction.
- [ ] Add refund/cancellation terms that match your payment provider.
- [ ] Add business/tax details required by your payment provider (Stripe/Paddle/Lemon Squeezy etc.).
- [ ] Make sure pricing page says what is included and what is not.
- [ ] If storing user accounts/emails, be clear about data retention and deletion requests.

## Ongoing

- [ ] Monitor security email.
- [ ] Don't claim "secure", "certified", or "guaranteed". Say "scanned for common public signals".
- [ ] If a scan finds a real exposed secret, treat evidence carefully; don't republish it.
- [ ] Update legal pages when product behavior changes (accounts, billing, monitoring, data retention).
