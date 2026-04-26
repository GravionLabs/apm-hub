---
name: helm-debug
description: 'Diagnose a failed or stuck Helm release: inspect release state, history, rendered manifests, and Kubernetes event logs to identify the root cause.'
allowed-tools: execute shell runCommands read search codebase
model: claude-sonnet-4.6
---

Diagnose a failed or stuck Helm release.

## What this skill does
Collects release state, revision history, rendered manifests, and Kubernetes events to identify why a Helm release failed or is stuck.

## Steps

### Phase 1 — Gather release state
1. Ask: release name, namespace (default: `default`), and Kubernetes context (if multi-cluster)
2. Check current release status:
   ```bash
   helm status <release> -n <namespace>
   helm history <release> -n <namespace>
   ```

### Phase 2 — Inspect manifests and values
3. Retrieve the rendered manifests and values of the current (or failing) revision:
   ```bash
   helm get all <release> -n <namespace>
   helm get values <release> -n <namespace>
   ```

### Phase 3 — Kubernetes events
4. Describe failing workloads and check events:
   ```bash
   kubectl get pods -n <namespace> -l "app.kubernetes.io/instance=<release>"
   kubectl describe pod <failing-pod> -n <namespace>
   kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -30
   ```

### Phase 4 — Diagnose and recommend
5. Identify root cause (image pull error, probe failure, resource quota, RBAC, invalid manifest)
6. Suggest fix or rollback:
   ```bash
   # Rollback to last successful revision
   helm rollback <release> <revision> -n <namespace>
   ```

## Common failure patterns
- `ErrImagePull` / `ImagePullBackOff` — wrong tag, missing imagePullSecret, registry auth
- `CrashLoopBackOff` — bad entrypoint, missing env/config, readinessProbe misconfigured
- `Pending` pods — resource quota exceeded, no matching node selector/taint
- Helm `FAILED` state — Kubernetes API error in manifest (check `helm get manifest`)
- `pending-install` / `pending-upgrade` stuck — previous release left in broken state

## Stack
`helm` `kubectl` `helm status` `helm history` `helm get all` `helm rollback`

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better) for root-cause analysis. Use `/model` to switch.
