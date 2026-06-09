"""
SelfSurgeon Victim Agent: RouterBot — Emits real OTLP traces to Phoenix
"""

import os, json, random
from datetime import datetime
from typing import Dict, List

from dotenv import load_dotenv
load_dotenv()

try:
    from google import genai
    from google.genai import types
    GOOGLE_GENAI_AVAILABLE = True
except ImportError:
    GOOGLE_GENAI_AVAILABLE = False

try:
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.trace import Status, StatusCode
    from openinference.semconv.trace import SpanAttributes
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False

FLAWED_PROMPT = """You are a lead router. Route leads based on company_size:
- "small": under 50 employees -> route to SMB_SDR
- "enterprise": over 1000 employees -> route to ENT_AE
- "mid-market": everything else -> route to MM_REP

Input: {company_name}, {company_size}, {industry}
Output ONLY the route: SMB_SDR, MM_REP, or ENT_AE"""

FIXED_PROMPT = """You are a lead router. Route leads based on company_size:
- "small": 50 or fewer employees -> route to SMB_SDR
- "enterprise": 1000 or more employees -> route to ENT_AE
- "mid-market": between 51 and 999 employees -> route to MM_REP

Input: {company_name}, {company_size}, {industry}
Output ONLY the route: SMB_SDR, MM_REP, or ENT_AE

Boundary rules:
- Exactly 50 employees -> SMB_SDR
- Exactly 1000 employees -> ENT_AE"""


class RouterBot:
    def __init__(self, use_fixed_prompt: bool = False):
        self.use_fixed_prompt = use_fixed_prompt
        self.prompt = FIXED_PROMPT if use_fixed_prompt else FLAWED_PROMPT
        self.trace_count = 0
        self.tracer = None

        if GOOGLE_GENAI_AVAILABLE:
            api_key = os.getenv("GEMINI_API_KEY")
            self.client = genai.Client(api_key=api_key) if api_key and api_key != "your_key_here" else None
        else:
            self.client = None

        if OTEL_AVAILABLE:
            self._setup_tracing()

    def _setup_tracing(self):
        try:
            phoenix_host = os.getenv("ARIZE_PHOENIX_HOST", "http://localhost:6006")
            resource = Resource.create({"service.name": "selfsurgeon-victim", "project.name": "selfsurgeon-victim"})
            provider = TracerProvider(resource=resource)
            exporter = OTLPSpanExporter(endpoint=f"{phoenix_host}/v1/traces")
            provider.add_span_processor(SimpleSpanProcessor(exporter))
            trace.set_tracer_provider(provider)
            self.tracer = trace.get_tracer(__name__)
            print(f"[RouterBot] OTLP HTTP tracing enabled -> {phoenix_host}/v1/traces")
        except Exception as e:
            print(f"[RouterBot] Tracing setup warning: {e}")

    def route_lead(self, company_name: str, company_size: int, industry: str) -> Dict:
        self.trace_count += 1
        trace_id = f"trace_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{self.trace_count}"

        if self.client:
            prompt_input = f"Route this lead: {company_name}, {company_size} employees, {industry}"
            full_prompt = self.prompt.format(company_name=company_name, company_size=company_size, industry=industry)
            try:
                if self.tracer:
                    with self.tracer.start_as_current_span("llm_call") as span:
                        span.set_attribute("company_name", company_name)
                        span.set_attribute("company_size", company_size)
                        span.set_attribute("industry", industry)
                resp = self.client.models.generate_content(model="gemini-2.5-flash", contents=[prompt_input], config=types.GenerateContentConfig(system_instruction=full_prompt))
                route = resp.text.strip().upper()
                if "SMB" in route: route = "SMB_SDR"
                elif "MM" in route: route = "MM_REP"
                elif "ENT" in route: route = "ENT_AE"
                else: route = "UNKNOWN"
            except Exception as e:
                route = f"ERROR: {e}"
        else:
            route = self._simulate_route(company_size)

        expected = self._ground_truth(company_size)
        is_correct = (route == expected)
        result = {"trace_id": trace_id, "timestamp": datetime.now().isoformat(), "input": {"company_name": company_name, "company_size": company_size, "industry": industry}, "output": route, "expected": expected, "is_correct": is_correct, "prompt_version": "fixed" if self.use_fixed_prompt else "flawed"}
        print(f"[RouterBot] {company_name}({company_size}) -> {route} (expected: {expected}) {'OK' if is_correct else 'FAIL'}")
        return result

    def _simulate_route(self, company_size: int) -> str:
        if company_size < 50: return "SMB_SDR"
        elif company_size > 1000: return "ENT_AE"
        elif company_size == 50: return random.choice(["SMB_SDR", "MM_REP"])
        elif company_size == 1000: return random.choice(["MM_REP", "ENT_AE"])
        else: return "MM_REP"

    def _ground_truth(self, company_size: int) -> str:
        if company_size <= 50: return "SMB_SDR"
        elif company_size >= 1000: return "ENT_AE"
        else: return "MM_REP"

def nullcontext(enter_result=None):
    class _NC:
        def __enter__(self): return enter_result
        def __exit__(self, *a): pass
    return _NC()


def generate_test_cases(num_cases: int = 50) -> List[Dict]:
    cases = []
    boundaries = [{"company_name": f"BoundaryTest{i}", "company_size": s, "industry": ind} for i, (s, ind) in enumerate([(50, "saas"), (1000, "fintech"), (49, "healthcare"), (51, "ai"), (999, "retail"), (1001, "manufacturing")], 1)]
    inds = ["saas", "fintech", "healthcare", "ai", "retail", "manufacturing", "logistics", "education", "energy", "telecom"]
    random.seed(42)
    for i in range(num_cases - len(boundaries)):
        size = random.choice([40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51]) if random.random() < 0.5 else random.choice([990, 991, 992, 993, 994, 995, 996, 997, 998, 999, 1000, 1001])
        cases.append({"company_name": f"TestCompany{i+7}", "company_size": size, "industry": random.choice(inds)})
    return boundaries + cases


def main():
    print("=" * 60)
    print("SELFSURGEON - Victim Agent (RouterBot)")
    print("=" * 60)
    print("This agent emits real OTLP traces to Arize Phoenix")
    print()
    bot = RouterBot(use_fixed_prompt=False)
    test_cases = generate_test_cases(50)
    print(f"[RouterBot] Running {len(test_cases)} test cases...\n")
    results = []
    correct = incorrect = 0
    for i, case in enumerate(test_cases):
        r = bot.route_lead(case["company_name"], case["company_size"], case["industry"])
        results.append(r)
        if r["is_correct"]: correct += 1
        else: incorrect += 1
        if (i + 1) % 10 == 0:
            print(f"[RouterBot] Progress: {i+1}/{len(test_cases)} - Correct: {correct}, Incorrect: {incorrect}")
    print(f"\nAccuracy: {correct/len(test_cases)*100:.1f}%")
    print(f"Failures by size:")
    by_size = {}
    for r in results:
        if not r["is_correct"]:
            s = r["input"]["company_size"]
            by_size.setdefault(s, []).append(r)
    for s in sorted(by_size):
        print(f"  Size {s}: {len(by_size[s])} failures")
    os.makedirs("data", exist_ok=True)
    with open("data/router_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[RouterBot] Results saved to data/router_results.json")

    # Also save results to Phoenix dataset
    try:
        from phoenix_client import PhoenixClient
        pc = PhoenixClient()
        try:
            ds = pc.get_dataset("router_failures")
            examples = [{"input": r["input"], "output": {"expected": r["expected"], "actual": r["output"]}, "metadata": {"is_correct": r["is_correct"], "trace_id": r["trace_id"], "prompt_version": r["prompt_version"]}} for r in results]
            pc.add_dataset_examples("router_failures", examples)
            print(f"[RouterBot] Saved {len(examples)} failure examples to Phoenix dataset")
        except Exception as e:
            print(f"[RouterBot] Phoenix dataset save: {e}")
    except Exception as e:
        pass

if __name__ == "__main__":
    main()
