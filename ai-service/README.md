# InternOps AI Service

Standalone Python AI service for InternOps. Lives independently from the Node.js backend so AI interns can work on AI features without needing the full full-stack setup.

## Structure

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── api/__init__.py
│   ├── core/__init__.py
│   ├── providers/__init__.py
│   └── models/__init__.py
├── tests/
│   └── __init__.py
├── reference/     # Existing Node.js AI files — port these to Python
├── README.md
└── tasks.md       # What to do
```

## Communication

The Node.js backend (`backend/`) will call this service via REST API.

## Reference

Existing AI implementations live in `reference/` — port the logic to Python.
