# GCP infrastructure (Pulumi, Go)

Declarative IaC for everything the deploy pipeline depends on. The app's
Cloud Run service (`bms-web`) and job (`bms-migrate-seed`) are *not* here —
`.github/workflows/deploy.yml` creates/updates them per release; Pulumi
owns what changes rarely (DB, secrets, IAM, WIF, cache).

## Bootstrap (once)

Pulumi can't act on a project that doesn't exist, so the project itself is
created imperatively:

```bash
gcloud projects create vs-bms
gcloud billing projects link vs-bms --billing-account="$BILLING_ACCOUNT"
gcloud services enable serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com --project vs-bms
```

`$BILLING_ACCOUNT` is your billing account ID (`gcloud billing accounts
list`) — kept out of the repo. Also register it as a stack secret so
`pulumi up` can read it: `pulumi config set --secret
bms-infra:billingAccount "$BILLING_ACCOUNT"`.

## State + credentials

State is local (no Pulumi Cloud account needed); secrets in the state file
are encrypted with a passphrase you choose — save it, losing it orphans
the stack:

```bash
cd infra/pulumi
pulumi login --local
export PULUMI_CONFIG_PASSPHRASE=...   # your chosen passphrase
pulumi stack init vs-bms              # matches Pulumi.vs-bms.yaml
```

The GCP provider uses application-default credentials. Either
`gcloud auth application-default login`, or without a browser round-trip:

```bash
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)
```

(Token expires hourly; re-export as needed.)

## Deploy / inspect / destroy

```bash
pulumi preview   # diff against reality — the IaC superpower
pulumi up        # Cloud SQL for SQL Server takes ~15 min on first create
pulumi stack output                       # non-secret outputs
pulumi stack output appPin --show-secrets # the login PIN
pulumi destroy   # full teardown (Cloud SQL is the cost driver)
```

After `pulumi up`, wire GitHub (values from `pulumi stack output`):

```bash
gh variable set GCP_PROJECT_ID   -b vs-bms
gh variable set GCP_REGION       -b us-central1
gh variable set GCP_WIF_PROVIDER -b "$(pulumi stack output wifProvider)"
gh variable set GCP_DEPLOY_SA    -b "$(pulumi stack output deployServiceAccount)"
gh variable set TURBO_API        -b "$(pulumi stack output turboApi)"
gh secret set TURBO_TOKEN        -b "$(pulumi stack output turboToken --show-secrets)"
gh secret set TURBO_REMOTE_CACHE_SIGNATURE_KEY -b "$(openssl rand -base64 32)"
```

First merge to main then creates the job + service and deploys.
