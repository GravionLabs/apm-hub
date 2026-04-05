---
name: "create-k8s-deploy-workflow"
description: "Create a GitHub Actions workflow for deploying to Kubernetes (kubectl apply, Helm, or Kustomize) with OIDC auth"
allowed-tools: ["editFiles", "codebase"]
model: gpt-4.1
---

# Create Kubernetes Deploy Workflow

Use this skill to create a GitHub Actions workflow that deploys an application to Kubernetes.

## What this skill does

Creates `.github/workflows/deploy.yml` with:
- OIDC authentication to cloud provider (EKS / AKS / GKE)
- Kubeconfig setup via cloud CLI
- Deployment via `kubectl apply`, Helm, or Kustomize
- Image tag injection from the triggering event

## Deployment Tool Patterns

### kubectl apply
```yaml
- run: |
    kubectl set image deployment/$APP_NAME \
      $APP_NAME=$IMAGE:$IMAGE_TAG \
      --namespace $NAMESPACE
    kubectl rollout status deployment/$APP_NAME \
      --namespace $NAMESPACE --timeout=5m
```

### Helm upgrade
```yaml
- name: Helm upgrade
  run: |
    helm upgrade --install $APP_NAME ./charts/$APP_NAME \
      --namespace $NAMESPACE \
      --set image.tag=$IMAGE_TAG \
      --wait --timeout 5m
```

### Kustomize
```yaml
- run: |
    cd k8s/overlays/production
    kustomize edit set image $IMAGE_NAME=$IMAGE:$IMAGE_TAG
    kubectl apply -k .
    kubectl rollout status deployment/$APP_NAME -n $NAMESPACE
```

## Full Workflow Structure

```yaml
name: Deploy to Kubernetes

on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      image_tag:
        description: 'Docker image tag to deploy'
        required: true

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@<SHA>

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@<SHA>
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: eu-west-1

      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name my-cluster --region eu-west-1

      - name: Deploy
        env:
          IMAGE_TAG: ${{ github.ref_name }}
        run: |
          kubectl set image deployment/myapp myapp=myregistry/myapp:$IMAGE_TAG -n production
          kubectl rollout status deployment/myapp -n production --timeout=5m
```

## Constraints
- Deployments to production require `environment:` with required reviewers
- Use OIDC — no `KUBECONFIG` base64 stored in secrets
- Always wait for rollout completion (`kubectl rollout status` or `helm --wait`)
- Pin all action SHAs
