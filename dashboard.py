"""
SelfSurgeon Dashboard — Unified Control Panel
"""
import streamlit as st
import json, os, time, traceback
from datetime import datetime
from tools import ArizeMCPClient, FailureAnalyzer, PromptFixGenerator, SafetyValidator, FLAWED_PROMPT, FIXED_PROMPT
from victim_agent import RouterBot, generate_test_cases
from selfsurgeon_loop import SurgeryRecord

st.set_page_config(page_title="SelfSurgeon", page_icon="🔬", layout="wide")

if "mcp" not in st.session_state:
    st.session_state.mcp = ArizeMCPClient()
    st.session_state.pc = __import__('phoenix_client', fromlist=['PhoenixClient']).PhoenixClient()
    st.session_state.analyzer = FailureAnalyzer()
    st.session_state.generator = PromptFixGenerator()
    st.session_state.validator = SafetyValidator()
    st.session_state.surgeries = []
    st.session_state.traces = []
    st.session_state.spans = []
    st.session_state.datasets = []
    st.session_state.experiments = []
    st.session_state.prompt_versions = []
    st.session_state.failures = []
    st.session_state.running = False

mcp = st.session_state.mcp
analyzer = st.session_state.analyzer
generator = st.session_state.generator
validator = st.session_state.validator

def refresh_data():
    for label, func, attr in [
        ("traces", lambda: json.loads(mcp.list_traces(limit=20)), "traces"),
        ("spans", lambda: json.loads(mcp.list_project_spans(limit=100)), "spans"),
        ("datasets", lambda: json.loads(mcp.list_datasets()), "datasets"),
        ("experiments", lambda: json.loads(mcp.list_all_experiments()), "experiments"),
        ("prompt_versions", lambda: json.loads(mcp.list_prompt_versions("router_system_prompt")), "prompt_versions"),
    ]:
        try: setattr(st.session_state, attr, func())
        except: pass
    try:
        s = mcp.get_dataset_examples("surgery_log", limit=50)
        st.session_state.surgeries = [json.loads(ex.get("input","{}")) for ex in json.loads(s) if ex.get("input")]
    except: pass
    try:
        f = mcp.get_dataset_examples("router_failures", limit=200)
        all_ex = json.loads(f)
        st.session_state.failures = [ex for ex in all_ex if not ex.get("metadata",{}).get("is_correct",True)]
    except: pass

refresh_data()

# ── Sidebar ───────────────────────────────────────────────────────────────
st.sidebar.title("🔬 SelfSurgeon")
st.sidebar.caption("Autonomous AI Healer")
page = st.sidebar.radio("Navigation", [
    "Dashboard", "Victim Agent", "SelfSurgeon",
    "Traces", "Datasets", "Prompts", "Surgery Log"
])
if st.sidebar.button("🔄 Refresh", use_container_width=True):
    refresh_data()
    st.rerun()
st.sidebar.divider()
st.sidebar.metric("Traces", len(st.session_state.traces))
st.sidebar.metric("Failures", len(st.session_state.failures))
st.sidebar.metric("Surgeries", len(st.session_state.surgeries))
st.sidebar.divider()
st.sidebar.caption(f"Updated {datetime.now().strftime('%H:%M:%S')}")

# ═══════════════════════════════════════════════════════════════════════════
# DASHBOARD PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_dashboard():
    st.title("🏠 SelfSurgeon Dashboard")
    c1,c2,c3,c4,c5 = st.columns(5)
    c1.metric("Traces", len(st.session_state.traces))
    c2.metric("Failures", len(st.session_state.failures))
    c3.metric("Surgeries", len(st.session_state.surgeries))
    c4.metric("Deployments", sum(1 for s in st.session_state.surgeries if s.get("deploy_status")=="deployed"))
    c5.metric("Experiments", len(st.session_state.experiments))
    st.divider()
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Recent Surgeries")
        for s in st.session_state.surgeries[:5]:
            ft = s.get("failure_type","?")
            imp = s.get("improvement",0)
            dep = s.get("deploy_status","?")
            st.write(f"{'✅' if dep=='deployed' else '❌'} **{ft}** — {imp:+.0%}")
    with col2:
        st.subheader("Failures by Size")
        fails = st.session_state.failures
        if fails:
            sizes = {}
            for f in fails:
                sz = f.get("input",{}).get("company_size","?")
                sizes[sz] = sizes.get(sz,0)+1
            st.bar_chart(sizes)

# ═══════════════════════════════════════════════════════════════════════════
# VICTIM AGENT PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_victim():
    st.title("🎯 Victim Agent")
    st.caption("Generates test traffic with boundary bugs. Results go to Phoenix dataset + traces.")
    col1, col2 = st.columns([1,2])
    num = col1.number_input("Test cases", 10, 200, 50, step=10)
    use_fixed = col1.checkbox("Use fixed prompt")
    if col1.button("▶ Run", type="primary", use_container_width=True, disabled=st.session_state.running):
        st.session_state.running = True
        status = st.status("Running victim agent...", expanded=True)
        try:
            bot = RouterBot(use_fixed_prompt=use_fixed)
            cases = generate_test_cases(num)
            results = []
            correct = 0
            for i, case in enumerate(cases):
                r = bot.route_lead(case["company_name"], case["company_size"], case["industry"])
                results.append(r)
                if r["is_correct"]: correct += 1
                status.progress((i+1)/len(cases), text=f"[{i+1}/{len(cases)}] {case['company_name']}({case['company_size']}) -> {r['output']}")
                time.sleep(0.02)
            os.makedirs("data", exist_ok=True)
            with open("data/router_results.json","w") as f:
                json.dump(results, f, indent=2)
            pc = st.session_state.pc
            pc.ensure_dataset_exists("router_failures", "Router failure test cases")
            examples = [{"input": r["input"], "output": {"expected": r["expected"], "actual": r["output"]},
                "metadata": {"is_correct": r["is_correct"], "trace_id": r["trace_id"], "prompt_version": r["prompt_version"]}} for r in results]
            pc.add_dataset_examples("router_failures", examples)
            acc = correct/len(cases)*100
            status.update(label=f"✅ Done — {acc:.1f}% accuracy", state="complete")
            st.success(f"**{correct}/{len(cases)}** correct ({acc:.1f}%)")
            refresh_data()
        except Exception as e:
            status.update(label=f"❌ Error", state="error")
            st.error(traceback.format_exc())
        st.session_state.running = False
        st.rerun()
    with col2:
        st.metric("Dataset Failures", len(st.session_state.failures))
        fails = st.session_state.failures[:8]
        if fails:
            st.write("**Sample failures:**")
            for f in fails:
                inp = f.get("input",{})
                out = f.get("output",{})
                sz = inp.get("company_size","?")
                if isinstance(out, dict):
                    st.write(f"  Size {sz}: expected `{out.get('expected','?')}`, got `{out.get('actual','?')}`")
                else:
                    st.write(f"  Size {sz}: `{out}`")

# ═══════════════════════════════════════════════════════════════════════════
# SELFSURGEON PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_surgeon():
    st.title("🩺 SelfSurgeon")
    st.caption("6-step: OBSERVE → DIAGNOSE → PRESCRIBE → VALIDATE → DEPLOY → AUDIT")
    fails = st.session_state.failures
    st.metric("Failures Detected", len(fails))
    if st.button("▶ Run Surgery Cycle", type="primary", disabled=st.session_state.running or not fails):
        st.session_state.running = True
        status = st.status("Starting surgery...", expanded=True)
        out = st.empty()
        try:
            def prog(msg, pct):
                status.progress(pct, text=msg)
                out.info(msg)
                time.sleep(0.1)
            prog("Step 1/6: OBSERVE", 0.1)
            failures = []
            try:
                ds_json = mcp.get_dataset_examples("router_failures", limit=50)
                for ex in json.loads(ds_json):
                    meta = ex.get("metadata",{})
                    if not meta.get("is_correct", True):
                        failures.append({
                            "trace_id": meta.get("trace_id","unknown"),
                            "input": ex.get("input",{}),
                            "output": (ex.get("output",{}) or {}).get("actual",""),
                            "expected": (ex.get("output",{}) or {}).get("expected",""),
                            "company_size": ex.get("input",{}).get("company_size")
                        })
            except Exception as e:
                prog(f"OBSERVE error: {e}", 0.15)
            prog(f"Found {len(failures)} failures", 0.2)
            if not failures:
                status.update(label="✅ Healthy — no failures", state="complete")
                out.success("No failures found")
                st.session_state.running = False
                st.rerun()
                return
            prog("Step 2/6: DIAGNOSE", 0.3)
            clusters = {}
            for f in failures:
                analysis = analyzer.analyze(json.dumps(f))
                ft = analysis.get("failure_type","UNKNOWN")
                clusters.setdefault(ft, []).append(f|{"diagnosis": analysis})
            top = max(clusters.items(), key=lambda x: len(x[1]))
            ft, instances = top
            prog(f"Top: {ft} ({len(instances)} instances)", 0.4)
            prog("Step 3/6: PRESCRIBE", 0.5)
            try:
                pj = mcp.get_latest_prompt("router_system_prompt")
                pd = json.loads(pj)
                cur_prompt = pd.get("template", FLAWED_PROMPT)
                cur_ver = pd.get("version","v_unknown")
            except:
                cur_prompt = FLAWED_PROMPT
                cur_ver = "v_unknown"
            fix = generator.generate(current_prompt=cur_prompt, failure_type=ft,
                failure_description=json.dumps(instances[0]["diagnosis"]))
            new_prompt = fix.get("new_prompt", cur_prompt)
            prog(f"Fix: {fix.get('explanation','')[:80]}", 0.6)
            safety = validator.validate(new_prompt)
            if not safety.get("safe", False):
                prog(f"❌ Safety: {safety.get('concerns',[])}", 1.0)
                status.update(label="❌ Safety failed", state="error")
                st.session_state.running = False
                return
            prog("✅ Safety passed", 0.65)
            prog("Step 4/6: VALIDATE", 0.7)
            ver_tag = f"v_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            mcp.upsert_prompt("router_system_prompt", ver_tag, new_prompt, f"Fix {ft}")
            exp_res = json.loads(mcp.run_experiment("router_failures", cur_ver, ver_tag, ["accuracy"]))
            exp_id = exp_res.get("id","unknown")
            prog(f"Experiment: {exp_id[:25]}...", 0.8)
            time.sleep(1)
            exp_det = json.loads(mcp.get_experiment_by_id(exp_id))
            baseline = exp_det.get("baseline_scores",{}).get("accuracy",0.5)
            candidate = exp_det.get("candidate_scores",{}).get("accuracy",0.5)
            improvement = candidate - baseline
            prog(f"Baseline {baseline:.0%} → {candidate:.0%} ({improvement:+.0%})", 0.85)
            prog("Step 5/6: DEPLOY", 0.9)
            deploy_status = "rejected"
            if improvement > 0.05:
                try:
                    mcp.add_prompt_version_tag("router_system_prompt", ver_tag, "production")
                    deploy_status = "deployed"
                except: pass
            prog(f"Deploy: {deploy_status}", 0.95)
            prog("Step 6/6: AUDIT", 0.98)
            record = SurgeryRecord(
                timestamp=datetime.now().isoformat(), failure_type=ft,
                affected_traces=[i["trace_id"] for i in instances],
                diagnosis=instances[0]["diagnosis"],
                old_prompt_version=cur_ver, new_prompt_version=ver_tag,
                experiment_id=exp_id, baseline_accuracy=baseline,
                candidate_accuracy=candidate, improvement=improvement,
                deploy_status=deploy_status, safety_passed=True)
            mcp.ensure_dataset_exists("surgery_log","SelfSurgeon surgery audit log")
            mcp.add_dataset_examples("surgery_log",
                [{"input": record.to_dict(), "output": {"deploy_status": deploy_status},
                  "metadata": {"surgery_id": exp_id}}])
            status.update(label=f"✅ Complete — {deploy_status.upper()}", state="complete")
            out.success(f"**{ft}** | {improvement:+.0%} | {deploy_status}")
            refresh_data()
        except Exception as e:
            status.update(label=f"❌ Error", state="error")
            st.error(traceback.format_exc())
        st.session_state.running = False
        st.rerun()
    st.divider()
    st.subheader("Surgery History")
    for s in st.session_state.surgeries[-10:]:
        ts = s.get("timestamp","")
        try: ts_str = datetime.fromisoformat(ts.replace("Z","+00:00")).strftime("%H:%M:%S")
        except: ts_str = ts[-8:] if len(ts)>8 else ts
        ft = s.get("failure_type","?")
        imp = s.get("improvement",0)
        dep = s.get("deploy_status","?")
        with st.expander(f"{'✅' if dep=='deployed' else '❌'} {ts_str} — {ft} ({imp:+.0%})"):
            st.json(s)

# ═══════════════════════════════════════════════════════════════════════════
# TRACES PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_traces():
    st.title("📊 Traces")
    traces = st.session_state.traces
    st.caption(f"{len(traces)} traces in Phoenix project")
    n = st.selectbox("Show", [5,10,20,50], index=2, horizontal=True)
    for t in traces[:n]:
        tid = t.get("trace_id") or t.get("id","?")
        status = t.get("status_code") or t.get("status","?")
        ts = (t.get("start_time") or "")[:19]
        is_err = str(status).lower() in ("error","unset")
        with st.expander(f"{'❌' if is_err else '✅'} `{str(tid)[:35]}...` [{ts}] — {status}"):
            st.json(t)
            spans_json = mcp.get_spans(tid)
            spans = json.loads(spans_json)
            if spans:
                st.write(f"**Spans:** {len(spans)}")
                for sp in spans[:3]:
                    attrs = sp.get("attributes",{})
                    st.write(f"`{sp.get('name','?')}` — {json.dumps(attrs, indent=2)[:500]}")

# ═══════════════════════════════════════════════════════════════════════════
# DATASETS PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_datasets():
    st.title("💾 Datasets & Experiments")
    for ds in st.session_state.datasets:
        with st.expander(f"📁 {ds.get('name','?')} ({ds.get('example_count',0)} examples)"):
            st.write(ds)
    st.divider()
    st.subheader("Experiments")
    for e in st.session_state.experiments:
        eid = e.get("id","?")
        ds_name = e.get("dataset_name","?")
        s = e.get("status","?")
        with st.expander(f"{'✅' if s=='completed' else '⏳'} `{eid[:25]}...` — {ds_name}"):
            st.json(e)

# ═══════════════════════════════════════════════════════════════════════════
# PROMPTS PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_prompts():
    st.title("🔧 Prompt Registry")
    try:
        pj = mcp.get_latest_prompt("router_system_prompt")
        pd = json.loads(pj)
        current = pd.get("template", FLAWED_PROMPT)
        ver = pd.get("version","unknown")
    except:
        current = FLAWED_PROMPT
        ver = "unknown"
    col1, col2 = st.columns([1,2])
    with col1:
        st.metric("Versions", len(st.session_state.prompt_versions))
        st.metric("Current", str(ver)[:15])
        if st.button("🚀 Deploy Fixed Prompt"):
            tag = f"v_deploy_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            mcp.upsert_prompt("router_system_prompt", tag, FIXED_PROMPT, "Manual deploy of fixed prompt")
            mcp.add_prompt_version_tag("router_system_prompt", tag, "production")
            st.success(f"Deployed as {tag}")
            refresh_data()
            st.rerun()
    with col2:
        view = st.radio("View", ["Current","Flawed (Original)","Fixed (Target)"], horizontal=True)
    st.code({
        "Current": current or "No prompt",
        "Flawed (Original)": FLAWED_PROMPT,
        "Fixed (Target)": FIXED_PROMPT,
    }[view], language="text", line_numbers=True)

# ═══════════════════════════════════════════════════════════════════════════
# SURGERY LOG PAGE
# ═══════════════════════════════════════════════════════════════════════════
def show_surgery_log():
    st.title("📋 Surgery Audit Log")
    sur = st.session_state.surgeries
    if not sur:
        st.info("No surgeries recorded yet")
        return
    total = len(sur)
    deployed = sum(1 for s in sur if s.get("deploy_status")=="deployed")
    avg_imp = sum(s.get("improvement",0) for s in sur)/total if total else 0
    c1,c2,c3 = st.columns(3)
    c1.metric("Total", total)
    c2.metric("Deployments", deployed)
    c3.metric("Avg Improvement", f"{avg_imp:+.0%}")
    for s in reversed(sur):
        ts = s.get("timestamp","")
        try: ts_str = datetime.fromisoformat(ts.replace("Z","+00:00")).strftime("%Y-%m-%d %H:%M:%S")
        except: ts_str = ts
        ft = s.get("failure_type","?")
        dep = s.get("deploy_status","?")
        imp = s.get("improvement",0)
        with st.expander(f"{'✅' if dep=='deployed' else '❌'} {ts_str} | {ft} | {imp:+.0%}"):
            c1,c2 = st.columns(2)
            c1.write(f"**Old:** {s.get('old_prompt_version','?')[:20]}")
            c1.write(f"**New:** {s.get('new_prompt_version','?')[:20]}")
            c1.write(f"**Experiment:** {s.get('experiment_id','?')[:20]}")
            c2.metric("Baseline", f"{s.get('baseline_accuracy',0):.0%}")
            c2.metric("Candidate", f"{s.get('candidate_accuracy',0):.0%}")
            st.json(s)

# ── Router ────────────────────────────────────────────────────────────────
pages = {
    "Dashboard": show_dashboard,
    "Victim Agent": show_victim,
    "SelfSurgeon": show_surgeon,
    "Traces": show_traces,
    "Datasets": show_datasets,
    "Prompts": show_prompts,
    "Surgery Log": show_surgery_log,
}
pages.get(page, show_dashboard)()
st.divider()
st.caption("SelfSurgeon | Google Cloud Rapid Agent Hackathon | Arize Phoenix + Gemini")
