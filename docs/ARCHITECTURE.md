# KingApp architecture (as of the Phase 1 audit, 12 Oct 2026)

Written by reading the code on `main` (commit `f437dcb`). Nothing here was checked against the live Supabase project, because Phase 1 does not connect to it. Anything marked **unverified** needs a look in the Supabase dashboard.

## The short version

- Next.js 16 (App Router), React 19, TypeScript, Tailwind. Almost every page is a client component.
- **The browser is the main database.** Data lives in `localStorage` under keys that start with `kingapp.`. Supabase is a mirror: after a save, the app copies the records to Supabase, and on load it copies Supabase back into the browser.
- **There is no real login.** Users, plain-text passwords and roles are kept in a list and checked in the browser. Supabase Auth is not used.
- Supabase is reached with plain `fetch` calls to its REST API using the public anon key. There is no Supabase client library and no server-side database code.
- The only server code is the telephony API routes under `app/api/`.
- It is an installable PWA (`public/manifest.json`, `public/sw.js`) with an offline queue.

## Where the Supabase URL and key are set

| What | Where |
| --- | --- |
| Variable names | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Where they are read | `lib/supabase-config.ts` only (new in Phase 1). `lib/supabase.ts` imports from it. |
| Where values are set | Local: `.env.local` (git-ignored). Deployed: Vercel Project Settings, Environment Variables. |
| If they are empty | The app runs in browser-only mode and nothing is sent anywhere. |

No key is stored in the repo. `.env.example` lists the names only.

To point a deployment at the test project, set the two variables to the test project's values for the **Preview** environment, and the live project's values for **Production** only. See `docs/DEPLOY.md`.

## Data flow

1. A page calls a `lib/*-data.ts` function, which reads and writes `localStorage`.
2. On save, the function calls `upsertSupabaseRows` (`lib/supabase.ts`). Online, it posts all of that table's records to Supabase (`POST /rest/v1/<table>?on_conflict=id`, merge on duplicate). Offline or on failure, it queues the write in IndexedDB (`lib/offline-sync.ts`).
3. `syncSupabaseToLocalStorage` (`lib/live-data.ts`) runs on load. For each synced table: if Supabase has any rows, it **replaces** the browser copy with them; if Supabase is empty, it uploads the browser copy.
4. The queue replays when the device is back online. If a row changed on the server after the queued time, the item is marked `conflict` and shown as "Needs Admin Review" on `/sync-status`.

Every synced table has the same shape: `id text`, `company_id text` (nullable), `payload jsonb` (the whole record), `created_at`, `updated_at`. Business fields are inside `payload`, not in columns.

## Supabase tables

Tables the app code reads and writes (17):

| Table | Stores |
| --- | --- |
| `users` | Login accounts: username, **plain-text password**, role, company, permissions |
| `companies` | Company profile, status, logo |
| `products`, `product_prices` | Product master list and price history |
| `inventory_movements` | Stock in and out |
| `loading_records` | Loading and confirmation records |
| `sales_records` | Sales |
| `cash_records` | Cash handover |
| `returns_records` | Returns |
| `expenses_records` | Expenses |
| `audit_logs` | Who did what |
| `delivery_records`, `delivery_drivers`, `delivery_vehicles` | Delivery module |
| `customer_accounts`, `customer_debts`, `customer_payments` | Customer accounts, debts, payments |

The last six are written by the code but are **not in `supabase/schema.sql`**. Whether they exist in the live project is **unverified**.

Tables in `supabase/schema.sql` that no code uses yet (16): `suppliers`, `clients`, `supplier_clients`, `orders`, `order_items`, `payments` (client portal), and `call_center_agents`, `call_center_extensions`, `call_logs`, `call_events`, `call_recordings`, `call_queue`, `callbacks`, `complaints`, `payment_followups`, `client_notes` (call center). Those modules run on browser storage only.

Data that exists **only in the browser** and is never sent to Supabase: raw materials (`kingapp.rawMaterial*`), call center, CCRM issues, WhatsApp and chat messages, client portal orders and messages, marketer clients, minimum stock levels, sync metadata. If a phone's browser data is cleared, this data is gone.

## Login and roles today

- `app/login/page.tsx` calls `authenticateUser` in `lib/auth.ts`. It searches the user list (browser copy of `users`, falling back to the built-in list) for a matching username or email and a matching plain-text password. Inactive users and users of inactive companies are refused.
- On success, the user record without the password is saved as JSON in `localStorage` key `kingapp.session` (`lib/storage.ts`). That JSON is the session. There is no token and no expiry.
- `components/AppShell.tsx` reads the session on every page. No session sends you to `/login`. A role that is not in the page's `allowedRoles`, or fails `canAccessRoute`, is redirected.
- Offline login only works for usernames that have logged in on that device before.
- The built-in admin is `admin` / `admin123` (`lib/users-data.ts`), company `all`. It is also in the README and in `supabase/schema.sql`.

Roles (`lib/auth.ts`): `admin`, `supervisor`, `storekeeper`, `accountant`, `manager`, `marketer`, `callcenter` (CCRM agent), `supplier`, `client`. That is nine, not the three in the go-live plan.

Permissions (`lib/permissions.ts`): about 90 permission keys. Each role has a default set, and a user can have extra `permissions` and `deniedPermissions`. A route is allowed if the role is on the page's list and the user holds the route's permissions. This is checked in the browser only.

Companies: a user belongs to one company (`companyId`) or to `all` (admin). `companyId` is stored on records, but nothing in the database enforces it. Role and company filtering are done in the JavaScript.

## Pages

| Area | Routes | Roles (from `allowedRoles`) |
| --- | --- | --- |
| Entry | `/` (redirect), `/login` | everyone |
| Dashboard | `/dashboard`, `/executive` (admin only) | all staff |
| Loading | `/loading` (admin, supervisor, storekeeper), `/confirm-loading` (admin, supervisor, marketer) | as listed |
| Stock | `/inventory`, `/product-management`, `/price-management` (admin only), `/raw-materials`, `/admin/raw-materials` | admin, manager, storekeeper, supervisor, accountant (varies) |
| Sales and returns | `/sales`, `/returns` | admin, manager, supervisor, marketer, accountant / admin, supervisor, storekeeper |
| Money | `/cash`, `/expenses` | admin, supervisor, accountant |
| Customers | `/customers`, `/customers/debts`, `/customers/debts/approvals`, `/customers/payments`, `/customers/statements` | admin, manager, accountant, callcenter, supervisor, marketer (varies) |
| Delivery | `/delivery`, `/delivery/dispatch`, `/delivery/drivers`, `/delivery/routes`, `/delivery/reports` | admin, manager, storekeeper, marketer, callcenter (varies) |
| Reports | `/daily-report`, `/reports` | admin, manager, supervisor, accountant |
| Client orders | `/client-orders` | admin, storekeeper, accountant, marketer, manager, supervisor |
| Client and supplier portal | `/client-portal`, `/client-portal/messages`, `/supplier-dashboard` | client, supplier |
| Call center | `/call-center` and 17 sub-pages (queue, softphone, chat, WhatsApp, recordings, wallboard and others) | admin, manager, callcenter. Desktop only. |
| CCRM issues | `/ccrm/issues`, `/new`, `/[id]`, `/dispatch`, `/investigations`, `/reports`, `/resolution` | admin, manager, callcenter and others by permission |
| Admin | `/admin/users`, `/admin/companies`, `/admin/audit-log`, `/admin/call-center-numbers`, `/admin/dev-tools`, `/admin/reset-data` | admin (raw-materials also manager) |
| Utility | `/sync-status`, `/debug-offline` | staff |

`/admin/reset-data` deletes browser data only, not Supabase rows. The next sync can bring the records back from Supabase.

## Server routes

All under `app/api/`, none require a login:

- `POST/GET /api/call-center/incoming-call`: keeps incoming calls in server memory.
- `POST /api/telephony/{make-call, answer-call, end-call, hold-call, resume-call, transfer-call, status, recordings}`: call actions, run through `lib/providerAdapters.ts`. The default provider is `mock`.
- `POST /api/telephony/webhook`: provider events. It checks an HMAC signature only if a webhook secret is set.

Server-only environment variables (`.env.example`): `TELEPHONY_PROVIDER`, `TELEPHONY_*`, `TWILIO_*`, `THREE_CX_*`, `ASTERISK_*`.

## PWA and offline

- `public/manifest.json`: name KingApp, starts at `/login`, standalone, portrait.
- `public/sw.js` (cache `kingapp-pwa-v3`): caches the app shell and main routes, serves `offline.html` when offline.
- `lib/offline-sync.ts`: IndexedDB queue of pending writes with `pending`, `synced`, `failed` and `conflict` states.

## Database files

- `supabase/schema.sql`: the original hand-kept schema. Left unchanged.
- `supabase/migrations/`: split into ordered files that a new, empty project can run top to bottom. They are **reconstructed from `schema.sql` plus the six extra tables, not exported from the live database**, so they can differ from live. See `supabase/README.md` for how to export the real structure.

## What this means for Phase 2

The go-live plan assumes a link from each user to a company and a role, with the database enforcing it. Today the database cannot tell who is asking, because every request uses the same anon key and there is no Supabase Auth login. Row Level Security rules need a signed-in identity to filter on. So Phase 2 needs a real login (Supabase Auth, or another way to issue a signed token) as well as `company_id` columns and policies. That is more than the one-week estimate assumes, and it changes how every page logs in. The security notes were given to the owner separately and are not in this public repo.
