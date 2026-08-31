# Centre of Excellence PMIS

Foundation Vite + React + TypeScript + Firebase portal for SCERT Punjab's Centre of Excellence project monitoring.

## Included in this stage

- Firebase Authentication sign-in shell
- Role-aware Firestore rules structure
- Dashboard shell with DIET, phase, activity, and placeholder progress cards
- DIET list with phase and status filters
- DIET detail placeholder
- Activity master grouped by activity head with search
- Civil agency master for agency records
- Role-based registration and SCERT approval queue
- SCERT-controlled approved-user assignment with history and audit records
- Admin settings/master data placeholder
- Idempotent seed script for `phases`, `diets`, `activityMaster`, and `agencies`

## Setup

```bash
npm install
```

Copy `.env.example` to `.env.local` beside `package.json` and fill in your Firebase web app values.

```bash
npm run dev
```

Open the Civil Agencies page from the sidebar or visit:

```text
http://127.0.0.1:5173/agencies
```

Open new user registration from the login page or visit:

```text
http://127.0.0.1:5173/register
```

## Deployment Architecture

- The React/Vite frontend is hosted on Cloudflare Pages.
- Firebase Authentication handles user login.
- Cloud Firestore stores DIET, activity, agency, financial, and file metadata.
- Cloudflare R2 stores images and PDF documents.
- A Cloudflare Worker will securely upload and retrieve R2 objects in a future phase.
- React must never contain R2 access keys, secret keys, Cloudflare API tokens, or Firebase service-account credentials.
- Cloudflare Pages build command: `npm run build`
- Cloudflare Pages output directory: `dist`
- Client-side route fallback: `public/_redirects` with `/* /index.html 200`

Firebase Hosting is not used. Firestore security rules can still be deployed independently:

```bash
firebase deploy --only firestore:rules
```

Enable the Firebase Authentication email/password provider before using login or registration. Frontend credentials must use `VITE_FIREBASE_*`. Firebase Admin/service-account credentials and Cloudflare R2 keys must never be exposed through React environment variables.

## Firebase Frontend Setup

1. In Firebase Console, create or open the project for Centre of Excellence PMIS.
2. Register a Firebase Web app.
3. Copy the web app configuration values into `.env.local` beside `package.json`.
4. Required Vite variables:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

5. Enable **Authentication -> Sign-in method -> Email/Password**.
6. Create the Cloud Firestore default database.
7. Restart `npm run dev` after changing `.env.local`; Vite does not reliably pick up new environment variables without a restart.

The app does not initialize Firebase Storage. Images and PDFs will use Cloudflare R2 through a secure Cloudflare Worker in a later phase.

### Invalid API Key Troubleshooting

If login or registration shows `auth/api-key-not-valid`:

1. Open Firebase Console.
2. Go to **Project Settings**.
3. Open the registered **Web App** for this project.
4. Copy the Firebase config values into `.env.local`.
5. Ensure all six values belong to the same Firebase project:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
6. Restart `npm run dev` after editing `.env.local`.
7. Enable **Authentication -> Email/Password**.
8. Create the Cloud Firestore default database.

`.env.example` is only a template. It is not read as the production credential source and must not contain real credentials.

## Seed master data

Make sure `.env` contains the Firebase config, then run:

```bash
npm run seed
```

The agency seed uses fixed document IDs and only creates missing documents. It is safe to run repeatedly and does not overwrite manually updated agency records.

Sample agencies seeded:

- Public Works Department
- Punjab Mandi Board
- PSIEC
- Private Contractor Sample

## Civil Agencies

Use `/agencies` or select **Civil Agencies** in the sidebar. An active `scert_admin` can select **Add Agency**, complete the form, and save. Use **Edit** to update a record and **Activate** or **Deactivate** to change its availability. Other authenticated roles receive read-only access where permitted by Firestore rules.

## User Registration

Use `/register` or select **New user? Register** on the login page. Applicants first select an organisation role and one of the 22 Punjab districts, then complete the detailed registration form. Public registration roles are limited to DIET, PWD, and RDP. SCERT Admin, SCERT Viewer, Finance Officer, and Monitoring Officer roles can only be assigned by an authorised SCERT administrator.

New registrations create a Firebase Authentication account, a `users/{uid}` profile with `approvalStatus = "pending"` and `active = false`, and a `registrationRequests/{uid}` queue record. Pending users are sent to `/registration-pending` and cannot access portal modules until approved.

## SCERT Approval

SCERT admins can open `/admin/registration-requests` from the sidebar. The page supports status, organisation type, district, and search filters. Pending requests can be viewed, approved, or rejected.

On approval, the admin can adjust the proposed system role and optionally assign a DIET or agency. DIET registrations default to `diet_nodal_officer`; PWD and RDP registrations default to `agency_user`. On rejection, a reason is required and the Firebase Authentication account is not deleted.

Login behaviour:

- Approved and active users enter the portal.
- Pending users are redirected to `/registration-pending`.
- Rejected users see the rejection message and reason.
- Suspended or missing-profile users are denied access with a contact-SCERT message.

## Approved-user assignment

Approval allows SCERT to accept the registration. Assignment determines which DIET or executing agency the user may manage.

SCERT administrators use `/admin/user-assignments` to assign an approved DIET user to one active DIET, a PWD user to an active PWD executing agency, or an RDP user to an active RDP executing agency. Matching-district records are listed first; selecting another district displays a warning. Private contractors are never assignment targets.

Reassignment ends the prior active `userAssignments` history record and creates a new active record. Deactivation clears the current role-appropriate assignment IDs without deleting the user, authentication account, approval, registration, or historical records. Audit entries are stored in `auditLogs`.

Approved DIET/PWD/RDP users whose assignment is missing are restricted to `/assignment-pending`; inactive assignments show a separate contact-SCERT message. The page includes a status refresh and logout action. Older approved profiles are safely interpreted with empty ID arrays, null primary IDs, and `assignmentStatus = "unassigned"`.

## Demo SCERT Administrator

The demo SCERT administrator credentials are for development only. Never use the demo password or account in production.

Example local development values:

- Email: `scert.demo@example.com`
- Password: `testing`
- Display name: `Demo SCERT Administrator`

Create a local `.env.admin` or shell environment with:

```bash
DEMO_SCERT_ADMIN_EMAIL=scert.demo@example.com
DEMO_SCERT_ADMIN_PASSWORD=<set-a-local-demo-password>
DEMO_SCERT_ADMIN_NAME=Demo SCERT Administrator
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.local.json
```

Then run:

```bash
npm run create:demo-admin
```

The script uses Firebase Admin SDK, creates the Authentication user only if missing, and creates or updates `users/{uid}` as an approved `scert_admin`. Before production, delete or disable this demo account and replace it with the actual SCERT administrator account. Service-account files and admin env files are ignored by `.gitignore`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run seed
npm run create:demo-admin
```

## Project Execution Flow

The lifecycle is phase-aware. Phase behavior follows the phase sequence stored with the DIET and financial records; it is never inferred from a DIET name.

### Phase I / II — historical financial execution

PAB approval was completed historically. PMIS begins with canonical Activity Master-linked approved financial data. Scope, Architecture, proposal preparation, and a new PAB workflow are not prerequisites.

```text
Historical PAB Approval
↓
Activity Approved Amount
↓
Principal / Agency Allocation
↓
Financial Transactions
↓
Work Package where applicable
↓
Expenditure / UC / Spillover
```

The application currently records the approved amount, Principal/Agency allocations, independent release/transfer/expenditure transactions, and agency-funded Work Package commitments. UC and spillover calculations remain future work.

### Phase III onward — full pre-PAB development

Direct manual approved-amount entry is blocked. Approved activity financials must eventually originate from the future PAB decision workflow.

```text
Scope
↓
Architecture
↓
Technical Proposal
↓
SCERT State Proposal
↓
DoSE&L / PAB
↓
PAB Approval
↓
Activity Financials
↓
Work Package
↓
Execution / Finance
```

The centralized phase-capability model reserves Scope, Architecture, proposal, and PAB prerequisites for Phase III and later. This change does not implement the future proposal or PAB workflow.

```text
SCERT
  ↓
DIET
  ↓
Executing Agency
  ↓
Scope of Work
  ↓
Work Package
  ↓
Activities
  ↓
Tender (future phase)
  ↓
Contractor (future phase)
```

An executing agency is the government or public organisation responsible for executing or procuring work; it is distinct from a private contractor selected later through tendering. A DIET may have multiple executing-agency assignments for different scopes, and each agency may manage multiple work packages. The authoritative relationship is stored in `dietAgencyAssignments`, preserving assignment history rather than overwriting it.

SCERT assigns the executing agency to a DIET without defining the work scope. For Phase I/II, Work Packages may be recorded directly against approved agency-funded activities because the historical PAB process is already complete. For Phase III onward, the DIET nodal officer uses the pre-PAB Scope and Architecture lifecycle before financially active Work Packages are created. Executing-agency users may contribute to assigned draft work, while SCERT retains review and approval authority.

Work packages group approved activities. Phase I/II historical packages do not require Scope, Architecture, or a new PAB workflow record; Phase III+ native packages require the pre-PAB lifecycle. Funding defaults to Centre 60% and State 40%. The current financial basis is Technical Sanction when present, otherwise Administrative Approval when present, otherwise Estimated Cost. These amounts remain distinct. `approved_for_tender` means the package is ready for procurement; it does not itself create a tender or select a contractor.

## Private Contractors

An executing agency is not a private contractor. Executing agencies are government or public organisations that manage execution and procurement; contractors and suppliers are private master records that may participate in future tenders.

```text
DIET
  ↓
Executing Agency
  ↓
Work Package
  ↓
Tender (future)
  ↓
Bidder / Contractor
  ↓
Tender Award (future)
```

Contractors are maintained in the shared `contractors` collection and are not permanently assigned to a DIET, work package, PWD, RDP, or another executing agency. An agency-created record may retain source-agency provenance, but that does not represent ownership. Contractor login accounts and tender participation are not included in this phase.

## Troubleshooting

If Vite loads but the browser shows a blank page, check that `src/App.tsx` exists and that `src/main.tsx` imports and renders it. A missing root React component can prevent the portal from mounting.

## User roles

- `scert_admin`: view and manage all records
- `scert_viewer`: read-only access
- `diet_nodal_officer`: view and update assigned DIET only
- `agency_user`: view and update assigned civil-work activities only
- `finance_officer`: view all DIETs and update financial fields only
- `monitoring_officer`: view all DIETs and add inspection remarks only

Create authenticated users in Firebase Authentication, then add matching documents in `users/{uid}` with the fields described in the project brief.
