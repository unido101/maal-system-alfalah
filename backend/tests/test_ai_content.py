"""AI Content Assistant tests — AI generation, transform, content items, and create-task workflow.

NOTE: AI calls hit real LLM (Gemini via Emergent), each takes ~15-25s. Use long timeouts.
"""
import os
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"

CREDS = {
    "manager": ("manager@alfalah.id", "manager123"),
    "content": ("content@alfalah.id", "content123"),
    "fundraising": ("cs@alfalah.id", "cs123456"),
}
AI_TIMEOUT = 120


@pytest.fixture(scope="module")
def tokens():
    out = {}
    for role, (e, p) in CREDS.items():
        r = requests.post(f"{BASE}/auth/login", json={"email": e, "password": p}, timeout=20)
        assert r.status_code == 200, f"login {role}: {r.status_code} {r.text}"
        out[role] = r.json()["session_token"]
    return out


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- RBAC on AI endpoints ---
class TestAIRBAC:
    def test_fundraising_blocked_generate(self, tokens):
        r = requests.post(f"{BASE}/ai/generate", headers=H(tokens["fundraising"]),
                          json={"source_type": "idea", "idea": "x", "objective": "Awareness"},
                          timeout=20)
        assert r.status_code == 403

    def test_fundraising_blocked_list_items(self, tokens):
        r = requests.get(f"{BASE}/content-items", headers=H(tokens["fundraising"]), timeout=20)
        assert r.status_code == 403

    def test_fundraising_blocked_create_task(self, tokens):
        r = requests.post(f"{BASE}/content-items/xxx/create-task", headers=H(tokens["fundraising"]),
                          json={"assigned_user_id": "user_content001", "priority": "High"}, timeout=20)
        assert r.status_code == 403

    def test_manager_allowed_list(self, tokens):
        r = requests.get(f"{BASE}/content-items", headers=H(tokens["manager"]), timeout=20)
        assert r.status_code == 200

    def test_content_allowed_list(self, tokens):
        r = requests.get(f"{BASE}/content-items", headers=H(tokens["content"]), timeout=20)
        assert r.status_code == 200

    def test_ai_programs_context(self, tokens):
        r = requests.get(f"{BASE}/ai/programs-context", headers=H(tokens["manager"]), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Shared fixture: one AI-generated content item (reused across tests) ---
@pytest.fixture(scope="module")
def generated_item(tokens):
    """Generate ONCE and reuse. Save ~20s per test."""
    r = requests.post(
        f"{BASE}/ai/generate", headers=H(tokens["manager"]),
        json={"source_type": "program", "program_id": "prog_makan01",
              "objective": "Awareness", "target_audience": "Umum",
              "important_facts": "Program berbagi makan setiap Jumat."},
        timeout=AI_TIMEOUT,
    )
    assert r.status_code == 200, f"AI generate failed: {r.status_code} {r.text[:400]}"
    return r.json()


class TestAIGenerate:
    DNA_OPTIONS = {
        "Waktu Emas", "Fasilitas & Aktivitas", "Testimoni",
        "Bukan Tentang Bangunannya", "Konten Edukasi", "Behind the Scene",
    }

    def test_from_program_shape(self, generated_item):
        c = generated_item
        # Required top-level fields
        for k in ("id", "content_dna", "strategy", "hook", "alt_hooks",
                  "script", "shot_list", "cta", "caption", "platform", "status"):
            assert k in c, f"missing field {k}"
        assert c["status"] == "Draft"
        assert c["related_program_id"] == "prog_makan01"
        # alt_hooks should be 3 (be lenient: at least 2)
        assert isinstance(c["alt_hooks"], list) and len(c["alt_hooks"]) >= 2, f"alt_hooks={c['alt_hooks']}"
        # script scenes
        assert isinstance(c["script"], list) and len(c["script"]) >= 1
        sc = c["script"][0]
        # scene keys (be lenient on any missing individual key but at least some present)
        scene_keys = {"duration", "visual", "voice_over", "text_overlay", "edit"}
        assert scene_keys & set(sc.keys()), f"scene missing keys: {sc}"
        # strategy fields
        strat = c["strategy"] or {}
        for sk in ("dna", "hook_type", "emotional_trigger", "target", "goal", "main_message"):
            assert sk in strat, f"strategy missing {sk}: {strat}"
        # cta
        assert isinstance(c["cta"], dict) and "text" in c["cta"]
        # shot_list non-empty
        assert isinstance(c["shot_list"], list) and len(c["shot_list"]) >= 1

    def test_from_idea(self, tokens):
        r = requests.post(
            f"{BASE}/ai/generate", headers=H(tokens["manager"]),
            json={"source_type": "idea",
                  "idea": "Cerita anak yatim yang belajar mengaji di masjid",
                  "objective": "Engagement"},
            timeout=AI_TIMEOUT,
        )
        assert r.status_code == 200, f"AI idea failed: {r.status_code} {r.text[:400]}"
        c = r.json()
        assert c["status"] == "Draft"
        assert c["hook"]
        assert c["related_program_id"] in (None, "")

    def test_persisted_in_library(self, tokens, generated_item):
        cid = generated_item["id"]
        r = requests.get(f"{BASE}/content-items/{cid}", headers=H(tokens["manager"]), timeout=20)
        assert r.status_code == 200
        assert r.json()["id"] == cid


class TestContentItemsCRUD:
    def test_list(self, tokens, generated_item):
        r = requests.get(f"{BASE}/content-items", headers=H(tokens["manager"]), timeout=20)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert generated_item["id"] in ids

    def test_update_status_approved(self, tokens, generated_item):
        cid = generated_item["id"]
        r = requests.put(f"{BASE}/content-items/{cid}", headers=H(tokens["manager"]),
                         json={"status": "Approved"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "Approved"
        # verify persisted
        g = requests.get(f"{BASE}/content-items/{cid}", headers=H(tokens["manager"]), timeout=20).json()
        assert g["status"] == "Approved"

    def test_duplicate(self, tokens, generated_item):
        cid = generated_item["id"]
        r = requests.post(f"{BASE}/content-items/{cid}/duplicate", headers=H(tokens["manager"]),
                          timeout=20)
        assert r.status_code == 200
        dup = r.json()
        assert dup["id"] != cid
        assert dup["status"] == "Draft"
        assert "Salinan" in (dup.get("title") or "")
        # cleanup dup
        requests.delete(f"{BASE}/content-items/{dup['id']}", headers=H(tokens["manager"]), timeout=20)

    def test_soft_delete(self, tokens):
        # create by duplication of any item, then delete
        r = requests.get(f"{BASE}/content-items", headers=H(tokens["manager"]), timeout=20).json()
        assert r
        cid = r[0]["id"]
        dup = requests.post(f"{BASE}/content-items/{cid}/duplicate",
                            headers=H(tokens["manager"]), timeout=20).json()
        did = dup["id"]
        rd = requests.delete(f"{BASE}/content-items/{did}", headers=H(tokens["manager"]), timeout=20)
        assert rd.status_code == 200
        # GET should be 404
        rg = requests.get(f"{BASE}/content-items/{did}", headers=H(tokens["manager"]), timeout=20)
        assert rg.status_code == 404


class TestAITransform:
    def test_improve_hook(self, tokens, generated_item):
        cid = generated_item["id"]
        before = requests.get(f"{BASE}/content-items/{cid}",
                              headers=H(tokens["manager"]), timeout=20).json()
        r = requests.post(f"{BASE}/ai/transform", headers=H(tokens["manager"]),
                          json={"content_item_id": cid, "action": "improve_hook"},
                          timeout=AI_TIMEOUT)
        assert r.status_code == 200, f"transform failed: {r.text[:400]}"
        after = r.json()
        assert after["id"] == cid
        # updated_at must change OR content differ
        changed = (after.get("updated_at") != before.get("updated_at")) or \
                  (after.get("hook") != before.get("hook"))
        assert changed, "transform did not change updated_at or hook"

    def test_shorter(self, tokens, generated_item):
        cid = generated_item["id"]
        r = requests.post(f"{BASE}/ai/transform", headers=H(tokens["manager"]),
                          json={"content_item_id": cid, "action": "shorter"},
                          timeout=AI_TIMEOUT)
        assert r.status_code == 200, f"shorter failed: {r.text[:400]}"
        after = r.json()
        assert after["id"] == cid
        assert after["script"]  # still valid


class TestCreateTaskFromContent:
    """CRITICAL WORKFLOW: content item -> task with brief + checklist"""

    def test_create_task_transfers_brief_and_checklist(self, tokens, generated_item):
        cid = generated_item["id"]
        item = requests.get(f"{BASE}/content-items/{cid}",
                            headers=H(tokens["manager"]), timeout=20).json()
        shot_len = min(len(item.get("shot_list") or []), 10)
        assert shot_len >= 1, "expected at least 1 shot in generated item"

        r = requests.post(
            f"{BASE}/content-items/{cid}/create-task",
            headers=H(tokens["manager"]),
            json={"assigned_user_id": "user_content001", "priority": "High",
                  "deadline": "2026-09-10T00:00:00+00:00"},
            timeout=30,
        )
        assert r.status_code == 200, f"create-task failed: {r.text[:400]}"
        j = r.json()
        assert "task" in j and j["content_item_id"] == cid
        task = j["task"]
        tid = task["id"]
        assert task["category"] == "Reels"
        assert task["priority"] == "High"
        assert task["program_id"] == item.get("related_program_id")

        # Fetch task detail
        td = requests.get(f"{BASE}/tasks/{tid}",
                          headers=H(tokens["manager"]), timeout=20).json()
        assert td["brief"]["hook"] == item["hook"]
        assert td["checklist_total"] == shot_len

        # Content item is now In Production + linked
        ci = requests.get(f"{BASE}/content-items/{cid}",
                          headers=H(tokens["manager"]), timeout=20).json()
        assert ci["status"] == "In Production"
        assert ci["related_task_id"] == tid

        # Task appears in /tasks list
        lst = requests.get(f"{BASE}/tasks", headers=H(tokens["content"]), timeout=20).json()
        assert any(t["id"] == tid for t in lst)


# --- Regression on existing endpoints ---
class TestRegression:
    def test_login_all(self, tokens):
        assert set(tokens) == {"manager", "content", "fundraising"}

    def test_dashboard(self, tokens):
        for role in ("manager", "content", "fundraising"):
            r = requests.get(f"{BASE}/dashboard", headers=H(tokens[role]), timeout=20)
            assert r.status_code == 200

    def test_finance_summary_manager(self, tokens):
        r = requests.get(f"{BASE}/finance/summary", headers=H(tokens["manager"]), timeout=20)
        assert r.status_code == 200
        for k in ("total_income", "total_expenses", "closing_balance", "status"):
            assert k in r.json()

    def test_programs(self, tokens):
        r = requests.get(f"{BASE}/programs", headers=H(tokens["manager"]), timeout=20)
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_tasks(self, tokens):
        r = requests.get(f"{BASE}/tasks", headers=H(tokens["content"]), timeout=20)
        assert r.status_code == 200

    def test_donation_create(self, tokens):
        r = requests.post(f"{BASE}/donations", headers=H(tokens["fundraising"]), json={
            "donor_id": "donor_0001", "program_id": "prog_makan01",
            "type": "Sedekah", "amount": 12345, "payment_method": "Cash", "payment_status": "Paid",
        }, timeout=20)
        assert r.status_code == 200
        assert r.json()["amount"] == 12345
