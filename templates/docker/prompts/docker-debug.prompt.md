---
name: docker-debug
description: "Step-by-step guided workflow to diagnose and fix Docker container issues: crashes, networking failures, volume problems, and resource constraints."
mode: ask
tools: [codebase, runCommands, problems]
---

# Docker Container Debugger

Use this prompt when a container is failing to start, crashing on startup, or behaving unexpectedly. Work through the steps in order.

## Step 1 — Identify the container and check logs

```bash
docker ps -a                                 # list all containers including stopped
docker logs <container_name_or_id>           # show all logs
docker logs --tail 50 <container>            # last 50 lines
```

Share the error output — it usually points directly to the cause.

## Step 2 — Check the exit code

```bash
docker inspect <container> --format '{{.State.ExitCode}} {{.State.Error}}'
```

| Exit code | Likely cause |
|---|---|
| `1` | Application error — check logs |
| `126` | Binary not executable — permission issue |
| `127` | `CMD`/`ENTRYPOINT` binary not found |
| `137` | Killed by OOM — not enough memory |
| `139` | Segfault — binary or library mismatch |

## Step 3 — Run the image with an overridden entrypoint

If the container exits immediately and logs don't help:

```bash
docker run -it --rm --entrypoint sh <image>     # Alpine
docker run -it --rm --entrypoint bash <image>   # Debian/Ubuntu

# Inside: verify files, permissions, env vars
ls -la /app
id
env | grep -v SECRET
```

## Step 4 — Debug networking

```bash
docker network ls
docker network inspect <network_name>

# Test service-to-service connectivity
docker exec <container> curl -sv http://<service>:<port>/health
docker exec <container> nslookup <service>       # DNS resolution
```

Check: are containers on the same network? Is the port exposed and not just `EXPOSE`d?

## Step 5 — Verify volume mounts

```bash
docker inspect <container> --format '{{json .Mounts}}' | python3 -m json.tool
docker exec <container> ls -la /data             # check mount is accessible
docker exec <container> touch /data/test         # check write permission
```

## Step 6 — Check resource limits

```bash
docker stats <container>                         # live CPU/memory/IO
docker inspect <container> --format '{{.HostConfig.Memory}} {{.HostConfig.NanoCPUs}}'
```

If memory is `0`, no limit is set (uses host memory). OOM kills show exit code `137`.

## Step 7 — Build and run in verbose mode

```bash
DOCKER_BUILDKIT=1 docker build --progress=plain -t debug-image .
docker run --rm -e LOG_LEVEL=debug debug-image
```

## Checklist

- [ ] Logs reviewed — primary error identified
- [ ] Exit code decoded
- [ ] Container filesystem inspected with overridden entrypoint
- [ ] Service networking verified (same network, DNS resolves, port reachable)
- [ ] Volume mounts checked (paths exist, correct permissions)
- [ ] Memory/CPU limits verified — OOM not the cause
- [ ] Issue resolved and Dockerfile/compose updated if needed
