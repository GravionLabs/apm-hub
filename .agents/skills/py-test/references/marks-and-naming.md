# Directory structure, marks, naming

## Directory

```
tests/
├── conftest.py
├── unit/
│   ├── conftest.py
│   └── test_<module>.py
├── integration/
│   ├── conftest.py
│   └── test_<module>.py
└── manual/
    └── test_<module>.py
```

Mirror `src/` layout.

## Marks

Every test gets exactly one type mark:

```python
@pytest.mark.unit
def test_parse_order_returns_total(): ...

@pytest.mark.integration
def test_order_service_saves_to_db(): ...

@pytest.mark.manual
def test_payment_gateway_live(): ...
```

Register in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
markers = [
    "unit: Fast tests with no external dependencies",
    "integration: Tests requiring external services, databases, or network",
    "manual: Must be run explicitly; never run in CI",
]
addopts = "--strict-markers -m 'not manual'"
```

## Naming

Pytest-style — scenario directly as `<condition>_<expected>`:
```python
def test_valid_id_returns_user(): ...
def test_null_id_raises_exception(): ...
def test_empty_input_returns_empty_list(): ...
```

**Parametrize** — meaningful IDs:
```python
@pytest.mark.parametrize("raw,expected", [
    ("{}", ValueError),
    ('{"id": 1}', None),
], ids=["empty-object", "valid"])
def test_validates_schema(raw, expected): ...
```
