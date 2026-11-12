# TOAST EXPRESS — HANDOFF (updated 2026-11-11)

## What it is
Toast delivery site for ESUI students. Plain HTML/CSS/vanilla JS (no build step), global `TX` namespace.
Design: cream / charcoal / toasted-orange, serif headings, video hero with poster fallback + live "TOAST EXPRESS" text overlay.
Data: `js/api.js` has two engines. `demo` = localStorage (local testing). `supabase` = Auth (phone → `phone@toastxpress.app`), RPCs, RLS. Live site uses supabase mode.
Hosting: GitHub repo -> Cloudflare Workers/Pages, build output dir `toast-xpress-site`. Live: https://toast-xpress.toastexpress-esui.workers.dev

## Base used for this restore
The original working zip (`toast-xpress-site.zip`), nothing redesigned. Only diffs vs it = the two features below (verified with diff).

## Added in this version
1. **Password recovery (security question, 3 tries)**
   - Sign-up step 3 asks a recovery question + answer. "Forgot your password?" on the login box: phone -> question -> answer + new password.
   - 3 wrong answers lock it -> "contact us" screen. Answer stored only as bcrypt hash (`recovery` table, RLS on, no policies).
   - Existing users and the admin get a nudge to set a question (profile modal / Kitchen page). Admin page has "Help a student with their password" (temporary password + unlock).
   - SQL functions in `supabase/schema.sql` section 5b: set_recovery, has_recovery, get_recovery_question, reset_password, admin_reset_password. Idempotent; re-run the whole file.
2. **Payment pop-up**: appears when the pay screen first shows, and again when tapping "I've paid" (Yes / Not yet / WhatsApp). Says: pay from an account with the same name as your profile; if different, WhatsApp us a photo/screenshot of the receipt. Inline yellow note + admin card line "Transfer should come from: <name>". Terms/Privacy updated.

## Files changed vs original
index.html, app.html, admin.html, privacy.html, terms.html, README.md, css/styles.css, js/ui.js, js/api.js, js/landing.js, js/app.js, js/admin.js, supabase/schema.sql.
New code is defensive: missing elements (e.g. old html + new js) cannot stop the page.

## NOT in the zip (keep your own copies on GitHub)
- `js/config.js` -> holds the live Supabase URL + anon key, `mode: "supabase"`.
- `assets/hero.mp4` -> lowercase name; set in config `video.mp4`. Poster fallback = `assets/toast.jpg` (included).

## Tests done
Playwright demo mode: sign-up with question, forgot flow (wrong x2, right), 3-wrong lockout, admin reset, admin own recovery + forgot as admin, pay popups, admin card note, images load, zero JS errors. Supabase-mode stub load: no errors. Mixed old/new files: no errors. SQL on local Postgres 16: all cases pass, schema re-runs cleanly.
NOT tested against the real Supabase project.

## Next steps
1. Supabase SQL Editor -> run full `supabase/schema.sql`.
2. GitHub: upload zip contents into `toast-xpress-site/` keeping folders (do NOT overwrite config.js). Check no stray duplicate files at repo root.
3. Hard refresh (Ctrl+Shift+R); test sign-up, forgot password, an order + popup.
4. Admin: set own recovery question.

## Outstanding
Confirm contact phone (08107522949 vs 09025095657); photo ownership of toast.jpg; fill business details + dataRegion in config.js; Nigerian lawyer review of legal pages.
