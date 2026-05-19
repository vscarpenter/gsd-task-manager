# GitHub Actions → AWS Setup Runbook

This is the one-time manual configuration required before `.github/workflows/deploy-dev.yml` (and later `deploy-prod.yml`, `deploy-cloudfront-infra.yml`) can deploy. Everything below happens in **your AWS account** and **your GitHub repo settings** — none of it is in code.

Trust model: GitHub-issued OIDC tokens authenticate to AWS roles scoped to specific GitHub Environments. No long-lived AWS access keys are stored anywhere.

---

## Step 1 — Add GitHub as an OIDC identity provider in AWS (once per account)

If your AWS account does not already have `token.actions.githubusercontent.com` as an IAM OIDC provider, add it:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

(Thumbprint is GitHub's well-known cert thumbprint; AWS now also accepts this provider without a thumbprint check, but supplying it is harmless and documented.)

Verify it exists:

```bash
aws iam list-open-id-connect-providers
```

---

## Step 2 — Create the development deploy role

### 2a. Trust policy

Save as `trust-policy-development.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:vscarpenter/gsd-task-manager:environment:development"
        }
      }
    }
  ]
}
```

The `sub` condition scopes this role to GitHub Actions runs **inside the `development` environment** of this specific repo. A different env or a different repo cannot assume it.

### 2b. Permission policy

Save as `policy-development.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DeployBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::gsd-dev.vinny.dev"
    },
    {
      "Sid": "S3DeployObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:PutObjectAcl"
      ],
      "Resource": "arn:aws:s3:::gsd-dev.vinny.dev/*"
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::<YOUR_ACCOUNT_ID>:distribution/E1HY1IKF5GT513"
    }
  ]
}
```

`cloudfront:GetInvalidation` is required by `aws cloudfront wait invalidation-completed` in the workflow.

### 2c. Create the role

```bash
aws iam create-role \
  --role-name gsd-deploy-development \
  --assume-role-policy-document file://trust-policy-development.json

aws iam put-role-policy \
  --role-name gsd-deploy-development \
  --policy-name gsd-deploy-development-inline \
  --policy-document file://policy-development.json
```

Note the role ARN — you'll paste it into the GitHub Environment in Step 3.

```
arn:aws:iam::<YOUR_ACCOUNT_ID>:role/gsd-deploy-development
```

---

## Step 3 — Create the `development` GitHub Environment

GitHub → `vscarpenter/gsd-task-manager` → **Settings → Environments → New environment** → name: `development`.

Required reviewers: **none** (dev auto-deploys on push to main, per locked decision §7.3).

Add these **Environment variables** (not secrets — none of these are confidential):

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<YOUR_ACCOUNT_ID>:role/gsd-deploy-development` |
| `S3_BUCKET` | `s3://gsd-dev.vinny.dev` |
| `CLOUDFRONT_ID` | `E1HY1IKF5GT513` |
| `ENV_LABEL` | `Development` |
| `SITE_URL` | `https://gsd-dev.vinny.dev` |

---

## Step 4 — First-run sanity check

1. Merge any commit to `main` (or trigger the workflow manually: Actions → Deploy to Development → Run workflow).
2. Watch the run — `deploy` job should:
   - Download the `static-export-<sha>` artifact from the CI run.
   - Assume the IAM role via OIDC (no secrets used).
   - Sync to S3, create + wait on the CloudFront invalidation.
   - Pass the four smoke-test assertions.
3. Verify the dev URL serves the new build: `curl -I https://gsd-dev.vinny.dev/`.

---

## Step 5 — Create the production deploy role and environment

Same shape as Steps 2-3, with these substitutions:

| Setting | Dev (already done) | Prod (this step) |
|---|---|---|
| IAM role name | `gsd-deploy-development` | `gsd-deploy-prod` |
| Trust `sub` claim | `repo:vscarpenter/gsd-task-manager:environment:development` | `repo:vscarpenter/gsd-task-manager:environment:production` |
| S3 bucket ARN | `arn:aws:s3:::gsd-dev.vinny.dev` | `arn:aws:s3:::gsd.vinny.dev` |
| CloudFront distribution ARN | `arn:aws:cloudfront::ACCT:distribution/E1HY1IKF5GT513` | `arn:aws:cloudfront::ACCT:distribution/E1T6GDX0TQEP94` |
| GitHub Environment name | `development` | `production` |
| Required reviewers | none | **vscarpenter** (locked decision §7.5) |
| `S3_BUCKET` var | `s3://gsd-dev.vinny.dev` | `s3://gsd.vinny.dev` |
| `CLOUDFRONT_ID` var | `E1HY1IKF5GT513` | `E1T6GDX0TQEP94` |
| `ENV_LABEL` var | `Development` | `Production` |
| `SITE_URL` var | `https://gsd-dev.vinny.dev` | `https://gsd.vinny.dev` |

Concretely:

```bash
# Reuse trust-policy-development.json, swap the sub claim, save as trust-policy-prod.json
sed 's|environment:development|environment:production|' \
  trust-policy-development.json > trust-policy-prod.json

# Reuse policy-development.json, swap the bucket name and distribution ID, save as policy-prod.json
sed -e 's|gsd-dev\.vinny\.dev|gsd.vinny.dev|g' \
    -e 's|E1HY1IKF5GT513|E1T6GDX0TQEP94|g' \
  policy-development.json > policy-prod.json

aws iam create-role \
  --role-name gsd-deploy-prod \
  --assume-role-policy-document file://trust-policy-prod.json

aws iam put-role-policy \
  --role-name gsd-deploy-prod \
  --policy-name gsd-deploy-prod-inline \
  --policy-document file://policy-prod.json
```

Then in GitHub: Settings → Environments → New environment → `production` →
- **Required reviewers:** add `vscarpenter`.
- **Variables:** the 5 from the table above, including `AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::ACCT:role/gsd-deploy-prod`.

### First-run prod test

1. Bump `package.json` version (e.g. 9.1.10 → 9.1.11), commit to main, merge via PR.
2. Tag the merge commit: `git tag v9.1.11 && git push origin v9.1.11`.
3. Watch the **Deploy to Production** workflow appear in Actions.
4. It pauses at "Waiting for approval" — go to **Environments → production** and approve.
5. The deploy runs, smoke-tests, completes. Verify `https://gsd.vinny.dev/` serves the new build.

A `workflow_dispatch` from the Actions tab also works — useful for re-deploying the current main without bumping the version.

---

## Step 6 — Create the CloudFront infrastructure role and environment

This role is separate from the app deploy roles because it has materially
broader privileges: it can publish new edge functions and modify the
distribution config. A misconfigured viewer-request function can take the
whole distribution offline, so the blast radius warrants a dedicated role
and a dedicated approval gate.

### 6a. Trust policy

Same shape as Step 2a, but the `sub` claim scopes to the new environment.
Save as `trust-policy-cloudfront-infra.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:vscarpenter/gsd-task-manager:environment:cloudfront-infra"
        }
      }
    }
  ]
}
```

### 6b. Permission policy

Save as `policy-cloudfront-infra.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageFunctions",
      "Effect": "Allow",
      "Action": [
        "cloudfront:ListFunctions",
        "cloudfront:DescribeFunction",
        "cloudfront:CreateFunction",
        "cloudfront:UpdateFunction",
        "cloudfront:PublishFunction"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AttachFunctionsToDistribution",
      "Effect": "Allow",
      "Action": [
        "cloudfront:GetDistributionConfig",
        "cloudfront:UpdateDistribution",
        "cloudfront:CreateInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::<YOUR_ACCOUNT_ID>:distribution/E1T6GDX0TQEP94"
    },
    {
      "Sid": "ManageResponseHeadersPolicy",
      "Effect": "Allow",
      "Action": [
        "cloudfront:ListResponseHeadersPolicies",
        "cloudfront:GetResponseHeadersPolicy",
        "cloudfront:CreateResponseHeadersPolicy",
        "cloudfront:UpdateResponseHeadersPolicy"
      ],
      "Resource": "*"
    }
  ]
}
```

Notes on resource scoping:

- `ManageFunctions` is `Resource: "*"` because CloudFront Function ARNs are
  not allowed in IAM resource scoping for these actions — they have to be
  account-wide. The trust-policy scoping to the `cloudfront-infra`
  environment is the actual access boundary.
- `AttachFunctionsToDistribution` is scoped to the prod distribution ID
  (the same one the prod app deploy role uses). Update if you add staging.
- `ManageResponseHeadersPolicy` is `Resource: "*"` for the same reason —
  IAM doesn't accept policy ARNs as scopes for these actions.

### 6c. Create the role

```bash
aws iam create-role \
  --role-name gsd-deploy-cloudfront-infra \
  --assume-role-policy-document file://trust-policy-cloudfront-infra.json

aws iam put-role-policy \
  --role-name gsd-deploy-cloudfront-infra \
  --policy-name gsd-deploy-cloudfront-infra-inline \
  --policy-document file://policy-cloudfront-infra.json
```

### 6d. Create the `cloudfront-infra` GitHub Environment

Settings → Environments → New environment → `cloudfront-infra`:

- **Required reviewers:** `vscarpenter` (same gate as production)
- **Variables:**

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<YOUR_ACCOUNT_ID>:role/gsd-deploy-cloudfront-infra` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1T6GDX0TQEP94` |

(No `S3_BUCKET` / `SITE_URL` / `ENV_LABEL` — this environment doesn't touch
S3 or run the app deploy.)

### First-run cloudfront-infra test

Pick the safer of the two scripts as the first test — the response headers
policy update is reversible and doesn't take the site down on failure:

1. Make a trivial whitespace edit to `cloudfront/response-headers-policy.json` on a branch.
2. Open + merge a PR.
3. Watch the **Deploy CloudFront Infrastructure** workflow appear in Actions.
4. Verify the "Detect what changed" step output shows `deploy_policy=true`, `deploy_functions=false`.
5. Approve in **Environments → cloudfront-infra**.
6. Verify the policy ID stays the same and the in-place update succeeded
   (`aws cloudfront get-response-headers-policy --id <ID>`).

For testing the function-deploy path, modify a comment in
`cloudfront-function-url-rewrite.cjs` (no behavior change), open + merge a PR,
approve, then `aws cloudfront describe-function --name gsd-url-rewrite --stage LIVE`
to confirm the new ETag.

---
