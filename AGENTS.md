# Butterfly Effect — Codex Engineering Instructions

## Product

Butterfly Effect is a synthetic Premier League-inspired match insight engine. It explains how pivotal football moments developed through an interactive 3D replay, player POV cameras, tactical evidence, and AI-generated commentary.

## Core architecture

- Frontend: React, TypeScript, Vite, React Three Fiber, Three.js, Drei, Zustand.
- Backend: Python, FastAPI, Pydantic, NumPy.
- AI: Azure OpenAI / Microsoft Foundry for structured, evidence-grounded explanations.
- Testing: Vitest, Playwright, pytest.
- Deployment: Azure Container Apps and GitHub Actions.

## Non-negotiable rules

1. Synthetic scenario data is the single source of truth for player positions, ball movement, and match events.
2. All 3D positions must derive from canonical replay time. Pausing, seeking, or switching cameras must not alter the underlying simulation.
3. Tactical calculations must be deterministic and performed in Python.
4. AI may explain validated evidence but must never invent player locations, tactical facts, or evidence IDs.
5. Simulated player field of view must not be described as proof of human awareness or intent.
6. Use seeded synthetic scenarios and validate all event and player references.
7. Use Pydantic schemas as the API contract and generate TypeScript types from OpenAPI.
8. Use TypeScript strict mode.
9. Keep secrets out of the frontend and Git repository.
10. Do not add databases, message brokers, physics engines, vector stores, or multi-agent frameworks without a demonstrated requirement.

## Development priorities

1. Working 3D pitch with 22 players and a ball.
2. Deterministic replay and timeline controls.
3. Broadcast, tactical, attacker POV, and defender POV cameras.
4. Evidence-linked tactical analysis.
5. Azure AI explanations.
6. Polished studio UI, automated tests, and deployment.

## Verification

- Run relevant frontend typecheck, lint, and tests after code changes.
- Run pytest and Ruff after backend changes.
- Use Playwright to verify visual and interactive functionality.
- Do not claim a feature works solely because the code compiles.

## Documentation

- Consult current official docs for unfamiliar APIs.
- Use Context7 for package documentation discovery.
- Consult OpenAI Developer Docs MCP for OpenAI APIs.
- Consult Microsoft Learn MCP for Azure APIs.

## Deadline

Hackathon submission deadline: October 27, 2026.
Prioritize a complete, impressive demo over unnecessary architecture.
