# pyproject.toml Example

```toml
[build-system]
requires = ["uv_build>=0.9,<0.10"]
build-backend = "uv_build"

[project]
name = "my-package"
version = "0.1.0"
requires-python = ">=3.14"
dependencies = ["httpx>=0.27"]

[dependency-groups]
dev = ["pytest>=8", "pytest-cov", "ruff"]

[tool.ruff]
line-length = 120
target-version = "py314"
fix = true

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"
addopts = "--strict-markers"
```
