"""Backend tests for BAITUL MAAL AL-FALAH.

Covers auth, RBAC, dashboard, programs, donors, donations, expenses, tasks,
brief/checklist, finance summary, reports, and dynamic relationship integrity.
"""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api"

CREDS = {
    "manager": ("manager@alfalah.id", "manager123"),
    "content": ("content@alfalah.id", "content123"),
    "fundraising": ("cs@alfalah.id", "cs123456"),
}


def _login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    return r


@pytest.fixture(scope="session")
def tokens():
    out = {}
    for role, (e, p) in CREDS.items():
        r = _login(e, p)
        assert r.status_code == 200, f"login failed for {role}: {r.status_code} {r.text}"
        out[role] = r.json()["session_token"]
    return out


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# --- Auth ---
class TestAuth:
    def test_login_all_roles(self, tokens):
        assert set(tokens) == {"manager", "content", "fundraising"}

    def test_me(self, tokens):
        r = requests.get(f"{BASE}/auth/me", headers=H(tokens["manager"]))
        assert r.status_code == 200
        assert r.json()["role"] == "manager"

    def test_me_unauth(self):
        r = requests.get(f"{BASE}/auth/me")
        assert r.status_code == 401

    def test_login_bad(self):
        r = _login("manager@alfalah.id", "wrong")
        assert r.status_code == 401

    def test_register_and_logout(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE}/auth/register",
                          json={"name": "TEST User", "email": email, "password": "pw123456", "role": "content"})
        assert r.status_code == 200
        tok = r.json()["session_token"]
        assert r.json()["user"]["email"] == email
        # logout
        r2 = requests.post(f"{BASE}/auth/logout", headers=H(tok))
        assert r2.status_code == 200
        # now me should fail
        r3 = requests.get(f"{BASE}/auth/me", headers=H(tok))
        assert r3.status_code == 401


# --- RBAC ---
class TestRBAC:
    def test_content_forbidden_finance(self, tokens):
        for path in ["/donors", "/donations", "/expenses", "/finance/summary",
                     "/reports/financial"]:
            r = requests.get(f"{BASE}{path}", headers=H(tokens["content"]))
            assert r.status_code == 403, f"content should be blocked at {path}, got {r.status_code}"

    def test_fundraising_expense_blocked(self, tokens):
        for path in ["/expenses", "/finance/summary", "/reports/financial", "/reports/expense"]:
            r = requests.get(f"{BASE}{path}", headers=H(tokens["fundraising"]))
            assert r.status_code == 403, f"fundraising should be blocked at {path}, got {r.status_code}"

    def test_fundraising_allowed(self, tokens):
        for path in ["/donations", "/donors", "/programs"]:
            r = requests.get(f"{BASE}{path}", headers=H(tokens["fundraising"]))
            assert r.status_code == 200, f"fundraising should be allowed at {path}"

    def test_manager_all(self, tokens):
        for path in ["/donations", "/donors", "/programs", "/expenses",
                     "/finance/summary", "/reports/financial", "/reports/expense",
                     "/reports/fundraising", "/reports/content"]:
            r = requests.get(f"{BASE}{path}", headers=H(tokens["manager"]))
            assert r.status_code == 200, f"manager blocked at {path}"


# --- Dashboard ---
class TestDashboard:
    def test_manager_dashboard(self, tokens):
        r = requests.get(f"{BASE}/dashboard", headers=H(tokens["manager"]))
        assert r.status_code == 200
        j = r.json()
        assert j["role"] == "manager"
        for k in ("today", "content", "fundraising", "finance", "attention"):
            assert k in j, f"manager dashboard missing {k}"

    def test_content_dashboard(self, tokens):
        r = requests.get(f"{BASE}/dashboard", headers=H(tokens["content"]))
        assert r.status_code == 200
        j = r.json()
        assert "content" in j and "today" in j
        assert "finance" not in j
        assert "fundraising" not in j

    def test_fundraising_dashboard(self, tokens):
        j = requests.get(f"{BASE}/dashboard", headers=H(tokens["fundraising"])).json()
        assert "fundraising" in j
        assert "finance" not in j


# --- Programs ---
class TestPrograms:
    def test_list_enriched(self, tokens):
        r = requests.get(f"{BASE}/programs", headers=H(tokens["manager"]))
        assert r.status_code == 200
        progs = r.json()
        assert len(progs) >= 1
        p = progs[0]
        for k in ("achievement", "total_raised", "total_expenses", "remaining_funds", "donation_count"):
            assert k in p

    def test_crud(self, tokens):
        r = requests.post(f"{BASE}/programs", headers=H(tokens["manager"]),
                          json={"name": "TEST Program", "target": 1000000, "status": "Active"})
        assert r.status_code == 200
        pid = r.json()["id"]
        # get
        r2 = requests.get(f"{BASE}/programs/{pid}", headers=H(tokens["manager"]))
        assert r2.status_code == 200 and r2.json()["name"] == "TEST Program"
        # update
        r3 = requests.put(f"{BASE}/programs/{pid}", headers=H(tokens["manager"]),
                          json={"name": "TEST Program 2", "target": 2000000, "status": "Active"})
        assert r3.status_code == 200 and r3.json()["name"] == "TEST Program 2"
        # delete
        r4 = requests.delete(f"{BASE}/programs/{pid}", headers=H(tokens["manager"]))
        assert r4.status_code == 200
        r5 = requests.get(f"{BASE}/programs/{pid}", headers=H(tokens["manager"]))
        assert r5.status_code == 404


# --- Donors ---
class TestDonors:
    def test_get_donor_with_history(self, tokens):
        r = requests.get(f"{BASE}/donors/donor_0001", headers=H(tokens["manager"]))
        assert r.status_code == 200
        j = r.json()
        assert "donations" in j
        for k in ("total_donations", "donation_count", "last_donation"):
            assert k in j


# --- Donations & dynamic integrity ---
class TestDonationIntegrity:
    def test_paid_donation_updates_program_and_finance(self, tokens):
        tok = tokens["manager"]
        # Baseline
        p_before = requests.get(f"{BASE}/programs/prog_makan01", headers=H(tok)).json()
        fin_before = requests.get(f"{BASE}/finance/summary", headers=H(tok)).json()
        dash_before = requests.get(f"{BASE}/dashboard", headers=H(tok)).json()

        r = requests.post(f"{BASE}/donations", headers=H(tok), json={
            "donor_name": "TEST Donor Inline", "program_id": "prog_makan01",
            "type": "Sedekah", "amount": 123456, "payment_method": "Cash", "payment_status": "Paid",
        })
        assert r.status_code == 200
        d = r.json()
        assert d["donor_name"] == "TEST Donor Inline"

        p_after = requests.get(f"{BASE}/programs/prog_makan01", headers=H(tok)).json()
        fin_after = requests.get(f"{BASE}/finance/summary", headers=H(tok)).json()
        dash_after = requests.get(f"{BASE}/dashboard", headers=H(tok)).json()

        assert p_after["total_raised"] - p_before["total_raised"] == 123456
        assert fin_after["total_income"] - fin_before["total_income"] == 123456
        assert dash_after["today"]["donations_today"] - dash_before["today"]["donations_today"] == 123456

    def test_pending_not_counted(self, tokens):
        tok = tokens["manager"]
        p_before = requests.get(f"{BASE}/programs/prog_makan01", headers=H(tok)).json()
        r = requests.post(f"{BASE}/donations", headers=H(tok), json={
            "donor_id": "donor_0001", "program_id": "prog_makan01",
            "type": "Sedekah", "amount": 99999, "payment_status": "Pending",
        })
        assert r.status_code == 200
        p_after = requests.get(f"{BASE}/programs/prog_makan01", headers=H(tok)).json()
        assert p_after["total_raised"] == p_before["total_raised"]

    def test_filters_and_search(self, tokens):
        tok = tokens["manager"]
        r = requests.get(f"{BASE}/donations?program_id=prog_makan01&status=Paid",
                         headers=H(tok))
        assert r.status_code == 200
        for d in r.json():
            assert d["program_id"] == "prog_makan01"
            assert d["payment_status"] == "Paid"


# --- Expenses ---
class TestExpenseIntegrity:
    def test_expense_updates_finance_and_program(self, tokens):
        tok = tokens["manager"]
        fin_before = requests.get(f"{BASE}/finance/summary", headers=H(tok)).json()
        p_before = requests.get(f"{BASE}/programs/prog_makan01", headers=H(tok)).json()
        r = requests.post(f"{BASE}/expenses", headers=H(tok), json={
            "program_id": "prog_makan01", "category": "Program",
            "description": "TEST expense", "amount": 55555, "payment_method": "Cash",
        })
        assert r.status_code == 200
        fin_after = requests.get(f"{BASE}/finance/summary", headers=H(tok)).json()
        p_after = requests.get(f"{BASE}/programs/prog_makan01", headers=H(tok)).json()
        assert fin_after["total_expenses"] - fin_before["total_expenses"] == 55555
        assert p_before["remaining_funds"] - p_after["remaining_funds"] == 55555
        assert fin_after["closing_balance"] == fin_after["total_income"] - fin_after["total_expenses"]
        assert fin_after["status"] in ("SURPLUS", "DEFICIT", "BALANCED")


# --- Tasks / Brief / Checklist ---
class TestTasks:
    def test_task_lifecycle(self, tokens):
        tok = tokens["content"]
        r = requests.post(f"{BASE}/tasks", headers=H(tok), json={
            "title": "TEST Task", "category": "Feed", "priority": "Medium", "status": "Draft"
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        # status
        r2 = requests.patch(f"{BASE}/tasks/{tid}/status", headers=H(tok),
                            json={"status": "In Progress"})
        assert r2.status_code == 200 and r2.json()["status"] == "In Progress"
        # brief
        r3 = requests.put(f"{BASE}/tasks/{tid}/brief", headers=H(tok),
                          json={"objective": "test obj", "platform": "Instagram"})
        assert r3.status_code == 200
        # checklist add
        c1 = requests.post(f"{BASE}/tasks/{tid}/checklist", headers=H(tok),
                           json={"item": "step 1"}).json()
        c2 = requests.post(f"{BASE}/tasks/{tid}/checklist", headers=H(tok),
                           json={"item": "step 2"}).json()
        # toggle one done
        r4 = requests.patch(f"{BASE}/tasks/{tid}/checklist/{c1['id']}", headers=H(tok),
                            json={"completed": True})
        assert r4.status_code == 200
        # progress calc
        det = requests.get(f"{BASE}/tasks/{tid}", headers=H(tok)).json()
        assert det["checklist_total"] == 2
        assert det["checklist_done"] == 1
        assert det["checklist_progress"] == 50
        assert det["brief"]["objective"] == "test obj"
        # delete checklist item
        rd = requests.delete(f"{BASE}/tasks/{tid}/checklist/{c2['id']}", headers=H(tok))
        assert rd.status_code == 200

    def test_task_search(self, tokens):
        r = requests.get(f"{BASE}/tasks?q=Reels", headers=H(tokens["content"]))
        assert r.status_code == 200
        assert any("Reels" in t["title"] for t in r.json())


# --- Reports ---
class TestReports:
    def test_financial(self, tokens):
        r = requests.get(f"{BASE}/reports/financial", headers=H(tokens["manager"]))
        assert r.status_code == 200
        assert "summary" in r.json()

    def test_expense_report(self, tokens):
        r = requests.get(f"{BASE}/reports/expense", headers=H(tokens["manager"]))
        assert r.status_code == 200 and "rows" in r.json()

    def test_fundraising_report(self, tokens):
        r = requests.get(f"{BASE}/reports/fundraising", headers=H(tokens["fundraising"]))
        assert r.status_code == 200 and "rows" in r.json()

    def test_content_report(self, tokens):
        r = requests.get(f"{BASE}/reports/content", headers=H(tokens["content"]))
        assert r.status_code == 200 and "by_status" in r.json()

    def test_program_report(self, tokens):
        r = requests.get(f"{BASE}/reports/program", headers=H(tokens["manager"]))
        assert r.status_code == 200 and "rows" in r.json()
