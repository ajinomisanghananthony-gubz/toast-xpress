# Toast Express — ordering website

Plain HTML + CSS + JavaScript. No build step. Opens in "demo mode" with fake data so you can try everything at once.

## Run it (5 minutes)
1. Unzip, open the folder in VS Code.
2. Install the **Live Server** extension, right-click `index.html` → *Open with Live Server*.
3. Customer: tap **Create account** and go through the 3 steps.
4. Admin (kitchen): log in with phone `08000000000`, password `admin123`.
   Tip: open the customer and the admin in two browser tabs side by side.

## Files
| File | What it is |
| --- | --- |
| `index.html`, `js/landing.js`, `js/scenes.js` | Home page, animated toast steps, create-account/login pop-up |
| `app.html`, `js/app.js` | Customer: live stock, order, pay, countdown, history, profile icon |
| `admin.html`, `js/admin.js` | Kitchen: daily stock, confirm payments, minutes, ready, delivered, settings |
| `js/api.js` | The only file that talks to data (demo engine + Supabase engine) |
| `js/config.js` | Brand, price, halls, icons, demo/supabase switch + keys |
| `css/styles.css` | All colors and styles (tokens at the top) |
| `supabase/schema.sql` | Real database: tables, security rules, stock-safe ordering |

## Also included
- **Hall dropdown:** Hall 1 to Hall 8 (edit `halls` in `js/config.js`).
- **Optional reviews:** after an order is received the student can leave stars and a comment; reviews show on the home page; the kitchen page can hide any review.

## Go live
Full steps are in the Build Guide doc. Short version: create a Supabase project, run `supabase/schema.sql`,
turn off "Confirm email", paste the URL + anon key into `js/config.js`, set `mode: "supabase"`,
make yourself admin with one SQL line, then drag the folder onto netlify.com/drop.

## Adding your hero video
1. Save your finished video as `assets/hero.mp4` (also `assets/hero.webm` if you have it).
2. Save one frame from it as `assets/toast.jpg` (the poster, shown while it loads).
3. In `js/config.js` → `video.ratio`, set the video's shape: "4 / 5", "1 / 1", "16 / 9" or "9 / 16".
4. Refresh. The "TOAST EXPRESS" text sits on top of the video automatically (change or clear it in `video.text`).
Tip: keep it under ~4 MB, 6 seconds, no sound needed (it autoplays muted and loops).

## Before you launch (legal + safety checklist)
1. Fill in `business` and `legal.dataRegion` in `js/config.js` (the yellow "DRAFT" bar on the legal pages disappears when done).
2. Set `mode: "supabase"` and re-run `supabase/schema.sql` (adds consent columns). NEVER launch in demo mode: demo data lives in each visitor's own browser and the demo admin password is public.
3. Replace `assets/toast.jpg` with a photo you own or are licensed to use.
4. Check `legal.allergens` is true for YOUR recipe.
5. Put the real bank details in Admin → Settings (account name should match your business or your own name).
6. Have a Nigerian lawyer read the 4 legal pages once. They are well-structured drafts, not legal advice.
7. Deleting a student on request: Supabase → Authentication → Users → delete (their profile and orders are removed with them). Do it within 30 days of the request, as the Privacy Policy promises.
8. If you ever add analytics or ads: add a consent banner FIRST and update cookies.html + privacy.html.
