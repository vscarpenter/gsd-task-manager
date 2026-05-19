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

## Future phases (heads-up)

- **Phase 4 — production deploy.** Same shape, separate role `gsd-deploy-prod` scoped to `environment:production`, separate GitHub Environment with a **required reviewer**.
- **Phase 5 — CloudFront infra.** Separate role `gsd-deploy-cloudfront-infra` with the additional `cloudfront:CreateFunction / UpdateFunction / PublishFunction / GetDistributionConfig / UpdateDistribution / *ResponseHeadersPolicy` permissions. Also gated by a required reviewer.

Each subsequent role reuses the OIDC provider from Step 1 — that step is one-time per AWS account.
