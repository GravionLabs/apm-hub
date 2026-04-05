---
name: Create Kubernetes Deploy Workflow
description: Create a GitHub Actions workflow for deploying to Kubernetes via kubectl, Helm, or Kustomize with OIDC authentication
mode: agent
tools: ["editFiles", "codebase"]
---

# Create Kubernetes Deployment Workflow

Generate a production-ready GitHub Actions deployment workflow.

## Step 1: Gather Requirements

Ask the user:
1. **Cloud provider / cluster**: AWS EKS / Azure AKS / GKE / On-premise
2. **Deployment tool**: `kubectl` / `helm` / `kustomize`
3. **Trigger**: Tags only (`v*.*.*`) / branch push / manual (`workflow_dispatch`)
4. **Namespace**: e.g., `production`, `staging`
5. **Environments**: GitHub Environments with required reviewers for production?
6. **Image source**: Where does the image tag come from? (prior build job / tag name / input)

## Step 2: Choose Auth Pattern

### AWS EKS (OIDC)
```yaml
permissions:
  id-token: write

- uses: aws-actions/configure-aws-credentials@<SHA>
  with:
    role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
    aws-region: ${{ vars.AWS_REGION }}

- run: aws eks update-kubeconfig --name ${{ vars.EKS_CLUSTER_NAME }} --region ${{ vars.AWS_REGION }}
```

### Azure AKS (OIDC)
```yaml
- uses: azure/login@<SHA>
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

- uses: azure/aks-set-context@<SHA>
  with:
    resource-group: ${{ vars.RESOURCE_GROUP }}
    cluster-name: ${{ vars.AKS_CLUSTER_NAME }}
```

## Step 3: Choose Deployment Tool

### kubectl
```yaml
- name: Deploy
  env:
    IMAGE_TAG: ${{ github.ref_name }}
  run: |
    kubectl set image deployment/$APP_NAME \
      $APP_NAME=$IMAGE_REPO:$IMAGE_TAG \
      --namespace $NAMESPACE
    kubectl rollout status deployment/$APP_NAME \
      --namespace $NAMESPACE \
      --timeout=5m
```

### Helm
```yaml
- name: Deploy with Helm
  run: |
    helm upgrade --install $APP_NAME ./charts/$APP_NAME \
      --namespace $NAMESPACE \
      --create-namespace \
      --set image.repository=$IMAGE_REPO \
      --set image.tag=$IMAGE_TAG \
      --atomic --timeout 5m \
      --wait
```

### Kustomize
```yaml
- name: Deploy with Kustomize
  run: |
    cd k8s/overlays/$ENVIRONMENT
    kustomize edit set image $IMAGE_REPO=$IMAGE_REPO:$IMAGE_TAG
    kubectl apply -k .
    kubectl rollout status -k . --timeout=5m
```

## Step 4: Add Environment Gate (Production)

For production deployments, add a GitHub Environment with required reviewers:
```yaml
jobs:
  deploy:
    environment: production   # requires manual approval if configured
    runs-on: ubuntu-latest
```

Configure at: Settings → Environments → production → Required reviewers

## Step 5: Create File

Create `.github/workflows/deploy.yml` with the assembled configuration.

## Constraints

- Production: always use `environment:` with required reviewers
- OIDC only — never store `KUBECONFIG` or cloud credentials as base64 secrets
- Always verify rollout success (`kubectl rollout status` or `helm --wait --atomic`)
- Pin all action SHAs to full commit hashes
- Keep deploy secrets in GitHub Environments (scoped), not repository secrets
