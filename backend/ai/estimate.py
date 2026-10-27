"""Offline size estimates only. Never constructs a provider, reads .env or sends a request.

Run: uv run python -m ai.estimate
UTF-8 bytes/4 is a rough comparison, not a tokenizer or Azure billing forecast.
"""

import json

from tactics.service import REGISTRY

from .config import AISettings
from .evidence import build_packet
from .providers import grounded_output_schema
from .request import prepare_request


def estimates():
    settings = AISettings(_env_file=None, ai_provider="mock")
    for scenario in REGISTRY:
        for kind in ("moment", "recap", "commentary"):
            packet = build_packet(
                scenario, "pass" if kind == "moment" else None, recap=kind == "recap"
            )
            for mode in ("casual", "analyst"):
                schema = grounded_output_schema(packet)
                request = prepare_request(packet, mode, settings, schema)
                schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
                old = (
                    request.instructions
                    + f"Explanation mode: {mode}\nTrusted packet:\n{packet.model_dump_json()}"
                    + schema_json
                )
                current = request.instructions + request.input + schema_json
                yield {
                    "scenario": scenario,
                    "kind": kind,
                    "mode": mode,
                    "before_rough_tokens": round(len(old.encode()) / 4),
                    "after_rough_tokens": round(len(current.encode()) / 4),
                    "reservation_input_tokens": request.input_bound,
                    "before_max_output": 3500,
                    "after_max_output": request.output_limit,
                }


if __name__ == "__main__":
    print(json.dumps(list(estimates()), indent=2))
