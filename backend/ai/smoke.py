"""Explicit paid smoke test. Never imported by the application or test suite.

Run from backend: uv run python -m ai.smoke [casual|analyst|recap|commentary]
Exactly one generation, zero retries. Only safe provenance/usage is printed.
"""

import argparse
import asyncio
import json

from .config import AISettings
from .providers import AIError
from .service import IntelligenceService


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "kind",
        nargs="?",
        default="casual",
        choices=("casual", "analyst", "recap", "commentary"),
    )
    parser.add_argument(
        "--mode",
        choices=("casual", "analyst"),
        help="Explanation style, including for recaps",
    )
    return parser.parse_args(argv)


async def main():
    args = parse_args()
    mode = args.mode or ("analyst" if args.kind == "analyst" else "casual")
    try:
        settings = AISettings(
            ai_provider="foundry",
            ai_max_retries=0,
            ai_max_output_tokens=3500 if args.kind == "commentary" else 1400,
        )
    except ValueError:
        raise SystemExit(
            "Invalid backend Foundry configuration; no request sent"
        ) from None
    service = IntelligenceService(settings)
    try:
        result = await service.get(
            "the-untouched-pass",
            mode,
            None if args.kind in ("recap", "commentary") else "dummy",
            recap=args.kind == "recap",
        )
        print(
            json.dumps(
                {
                    "calls": 1,
                    "provider": result.provider,
                    "mode": result.mode,
                    "prompt_version": result.prompt_version,
                    "served_measurement_references": sum(
                        s.kind == "measurement"
                        for s in result.narratives[0].key_evidence
                    ),
                    "cue_count": len(result.cues),
                    "usage": result.usage.model_dump(),
                    "headline": result.narratives[0].headline,
                }
            )
        )
        if result.provider != "foundry":
            raise SystemExit(
                "Live response did not pass claim screening; labeled fallback returned"
            )
    except AIError as error:
        raise SystemExit(str(error)) from None
    finally:
        await service.close()


if __name__ == "__main__":
    asyncio.run(main())
