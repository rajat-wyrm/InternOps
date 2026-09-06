# AI Service Tasks

## Reference Files to Port

These files from the existing Node.js backend are in `reference/` — port their logic to Python.

| File                         | Source                                 | What it does                                                                                |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `aiProviderService.js`       | `backend/src/services/`                | Multi-provider AI chat with failover, circuit breaker, caching                              |
| `ai_routes.js`               | `backend/src/modules/ai/`              | Chat + health endpoints                                                                     |
| `ai_repository.js`           | `backend/src/modules/ai/`              | DB queries for AI usage tracking                                                            |
| `ai_certificates_routes.js`  | `backend/src/modules/ai-certificates/` | Certificate AI endpoints                                                                    |
| `ai_certificates_service.js` | `backend/src/modules/ai-certificates/` | Certificate AI logic (validation, generation, templates, tones, languages, design, preview) |
| `config_index.js`            | `backend/src/config/`                  | Environment config for reference                                                            |

## Build Plan

1. **FastAPI app** with `/health` endpoint
2. **Chat API** (`POST /api/chat`) — multi-provider with failover
3. **Provider health** (`GET /api/providers/health`)
4. **Certificate endpoints** — port from `ai_certificates_service.js`
5. **Rate limiting, usage tracking, streaming**
6. **New features** — resume parsing, skill gap analysis, etc.
7. **Docker, tests, security**
