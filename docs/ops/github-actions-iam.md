# GitHub Actions → AWS Setup Runbook

> **Current status:** production is the only deploy target. The development
> deploy (`deploy-dev.yml` to gsd-dev.vinny.dev) was retired on 2026-09-11, so
> this runbook no longer creates a development role, environment, or variables.
> Production builds without AWS authority, signs the artifact, and grants AWS
> OIDC only after Gate 2 and provenance verification.

This is the one-time manual configuration required before `.github/workflows/deploy-production-release.yml` and `.github/workflows/deploy-cloudfront-infra.yml` can deploy. Everything below happens in **your AWS account** and **your GitHub repo settings**. None of it is in code.

The production workflow rename has merged, and
.github/workflows/deploy-prod.yml is absent from the default branch. The step
before that merge was to disable the retired workflow identity while its file
still existed. It is shown here as a record. A new setup does not run it:

~~~bash
gh workflow disable deploy-prod.yml
~~~

Do not reintroduce that path: historical release tags contain its
old workflow_dispatch implementation. The replacement path is
.github/workflows/deploy-production-release.yml.

Trust model: GitHub-issued OIDC tokens authenticate to AWS roles scoped to specific GitHub Environments. No long-lived AWS access keys are stored anywhere.

---

## Step 1: Add GitHub as an OIDC identity provider in AWS (once per account)

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

## Step 2: Create the production deploy role and environment

### 2a. Trust policy

Save as `trust-policy-prod.json`:

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
          "token.actions.githubusercontent.com:sub": "repo:vscarpenter/gsd-task-manager:environment:production"
        }
      }
    }
  ]
}
```

The `sub` condition scopes this role to GitHub Actions runs **inside the `production` environment** of this specific repo. A different env or a different repo cannot assume it.

### 2b. Permission policy

Save as `policy-prod.json`:

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
      "Resource": "arn:aws:s3:::gsd.vinny.dev"
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
      "Resource": "arn:aws:s3:::gsd.vinny.dev/*"
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "arn:aws:cloudfront::<YOUR_ACCOUNT_ID>:distribution/E1T6GDX0TQEP94"
    }
  ]
}
```

`cloudfront:GetInvalidation` is required by `aws cloudfront wait invalidation-completed` in the workflow.

### 2c. Create the role

```bash
aws iam create-role \
  --role-name gsd-deploy-prod \
  --assume-role-policy-document file://trust-policy-prod.json

aws iam put-role-policy \
  --role-name gsd-deploy-prod \
  --policy-name gsd-deploy-prod-inline \
  --policy-document file://policy-prod.json
```

Note the role ARN. You'll paste it into the GitHub Environment in Step 2d.

```
arn:aws:iam::<YOUR_ACCOUNT_ID>:role/gsd-deploy-prod
```

### 2d. Create the `production` GitHub Environment

GitHub → `vscarpenter/gsd-task-manager` → **Settings → Environments → New environment** → name: `production`.

Required reviewers: **vscarpenter** (locked decision §7.5).

Add these **Environment variables** (not secrets, because none of these are confidential):

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<YOUR_ACCOUNT_ID>:role/gsd-deploy-prod` |
| `S3_BUCKET` | `s3://gsd.vinny.dev` |
| `CLOUDFRONT_ID` | `E1T6GDX0TQEP94` |
| `SITE_URL` | `https://gsd.vinny.dev` |

The workflow sets `ENV_LABEL` itself, so the environment needs no such variable.
`SITE_URL` must start with `https://`, or the deploy job fails before it asks for AWS credentials.

Set **Deployment branches and tags** to selected protected contexts: protected
`main` plus the release-tag pattern `v*.*.*`. Repository-dispatch rollback runs
trusted workflow code from `main`; the workflow separately resolves and authorizes
the requested existing release tag before build or AWS access.

### First-run prod test

1. Bump `package.json` version (e.g. X.Y.Z → X.Y.Z+1) on a branch and merge via PR.
2. Tag the merge commit on `main` with the matching `vX.Y.Z` tag and push the tag.
3. Watch the **Deploy Production Release** workflow appear in Actions.
4. The security audit job runs first. Then the evidence job authorizes the tag and, when an earlier tag exists, prints the rollback command.
5. Confirm the build job has no environment, OIDC, or AWS permission.
6. Confirm the separate attestation job signs `static-export-<release-sha>.tgz` twice: build provenance and the exact-release predicate.
7. The deploy job pauses at "Waiting for approval" — review the evidence and approve.
8. Confirm the checksum, both `gh attestation verify` calls, the predicate match, and the archive validation (`scripts/verify-static-export-artifact.py`) complete before AWS configuration.
9. The credential-free smoke job completes. Verify `https://gsd.vinny.dev/`.

For rollback, send the `deploy-production-release` repository-dispatch event with
`client_payload.ref` set to an existing semantic release tag. Arbitrary branches,
commits, and caller-selected workflow refs are rejected. See `docs/ops/gate2.md`.

---

## Step 3: Create the CloudFront infrastructure role and environment

This role is separate from the app deploy role because it has materially
broader privileges: it can publish new edge functions and modify the
distribution config. A misconfigured viewer-request function can take the
whole distribution offline, so the blast radius warrants a dedicated role
and a dedicated approval gate.

### 3a. Trust policy

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

### 3b. Permission policy

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

### 3c. Create the role

```bash
aws iam create-role \
  --role-name gsd-deploy-cloudfront-infra \
  --assume-role-policy-document file://trust-policy-cloudfront-infra.json

aws iam put-role-policy \
  --role-name gsd-deploy-cloudfront-infra \
  --policy-name gsd-deploy-cloudfront-infra-inline \
  --policy-document file://policy-cloudfront-infra.json
```

### 3d. Create the `cloudfront-infra` GitHub Environment

Settings → Environments → New environment → `cloudfront-infra`:

- **Required reviewers:** `vscarpenter` (same gate as production)
- **Variables:**

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<YOUR_ACCOUNT_ID>:role/gsd-deploy-cloudfront-infra` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1T6GDX0TQEP94` |

(No `S3_BUCKET` / `SITE_URL` — this environment doesn't touch
S3 or run the app deploy.)

### First-run cloudfront-infra test

The workflow runs two scripts: `scripts/deploy-cloudfront-function.sh` and
`scripts/deploy-cloudfront-response-headers-policy.sh`. Pick the safer one, the
policy script, as the first test — the response headers
policy update is reversible and doesn't take the site down on failure:

1. Make a trivial whitespace edit to `cloudfront/response-headers-policy.json` on a branch.
2. Open + merge a PR.
3. Watch the **Deploy CloudFront Infrastructure** workflow appear in Actions. Its security audit job runs first.
4. Approve in **Environments → cloudfront-infra**. The deploy job, including its change detection, waits for this approval.
5. Verify the run summary from the "Detect what changed" step shows "Deploy Response Headers Policy: true" and "Deploy CloudFront Functions: false".
6. Verify the policy ID stays the same and the in-place update succeeded
   (`aws cloudfront get-response-headers-policy --id <ID>`).

This test assumes the policy already exists and is attached to the distribution's
default cache behavior. The script creates a missing policy but never attaches it.
After the create or update, it exits with an error when the distribution does not reference the policy.

The workflow also has a manual `workflow_dispatch` trigger. Its `deploy` input
takes `both` (the default), `functions`, or `policy`. A manual run deploys what
the input names instead of diffing the push, and still writes the plan summary.

For testing the function-deploy path, modify a comment in
`cloudfront-function-url-rewrite.cjs` (no behavior change), open + merge a PR,
approve, then `aws cloudfront describe-function --name gsd-url-rewrite --stage LIVE`
to confirm the new ETag.

---
