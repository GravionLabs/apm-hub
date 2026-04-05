---
name: docker-debug
description: 'Diagnose container startup failures, networking issues, volume mount problems, and resource constraints using docker logs, inspect, exec, stats, and network commands.'
allowed-tools: codebase runCommands
---

Diagnose why a Docker container is failing to start, crashing, or misbehaving.

## Stack
- **CLI:** Docker (`docker logs`, `docker inspect`, `docker exec`, `docker stats`, `docker network`)
- **Optional:** `docker compose logs`, `docker scout` for image scanning

## Step 1 — Check container logs

```bash
docker logs <container_id_or_name>          # last log output
docker logs --tail 100 <container>          # last 100 lines
docker logs --follow <container>            # stream logs
docker compose logs <service>               # for compose projects
```

Look for: exit codes, application errors, missing files, permission denied.

## Step 2 — Inspect container state

```bash
docker inspect <container>                  # full JSON config + state
docker inspect <container> | grep -A5 '"State"'
docker inspect <container> --format '{{.State.ExitCode}} {{.State.Error}}'
```

Common exit codes:
| Code | Meaning |
|------|---------|
| `0` | Clean exit (process finished normally) |
| `1` | General error |
| `125` | Docker daemon error |
| `126` | Permission denied (cannot execute) |
| `127` | Command not found (wrong CMD/ENTRYPOINT) |
| `137` | OOM kill (out of memory) |
| `139` | Segfault |

## Step 3 — Execute into container (if running)

```bash
docker exec -it <container> sh              # open shell (Alpine/scratch)
docker exec -it <container> bash            # open bash (Debian/Ubuntu)
docker exec <container> ls /app             # check file presence
docker exec <container> id                  # check running user
```

## Step 4 — Debug networking

```bash
docker network ls                           # list all networks
docker network inspect <network>            # container IPs, connections
docker inspect <container> --format '{{json .NetworkSettings.Networks}}'

# Test connectivity from inside container
docker exec <container> curl -s http://other-service:8080/health
docker exec <container> nslookup other-service
```

## Step 5 — Check volume mounts

```bash
docker inspect <container> --format '{{json .Mounts}}'
docker exec <container> ls -la /data        # verify mount is accessible
```

## Step 6 — Resource usage

```bash
docker stats <container>                    # live CPU/memory/network/IO
docker inspect <container> --format '{{.HostConfig.Memory}}'
```

OOM kill (exit 137): increase memory limit or profile memory usage.

## Step 7 — Run with overridden entrypoint (startup failures)

```bash
docker run -it --entrypoint sh <image>      # bypass CMD/ENTRYPOINT
docker run -it --entrypoint bash <image>
```

## Checklist
- [ ] Logs reviewed — error message identified
- [ ] Exit code checked — `137` = OOM, `127` = wrong CMD
- [ ] `docker inspect` state reviewed
- [ ] Volume mounts verified (paths exist, permissions correct)
- [ ] Network connectivity tested between services
- [ ] Resource limits checked — not hitting memory cap
