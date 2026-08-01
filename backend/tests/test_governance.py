async def test_governance_risk_priority(client):
    resp = await client.get("/governance/risk-priority")
    assert resp.status_code == 200
    body = resp.json()
    assert body["max_level"] == 5

    subjects_resp = await client.get("/subjects")
    subject_count = len(subjects_resp.json()["subjects"])
    # seed.py gives every subject exactly 30 days of usage_stats, well above
    # USAGE_HISTORY_MIN_DAYS (7) -- so nobody should be stuck "accumulating".
    assert len(body["accumulating"]) == 0
    assert len(body["scatter"]) == subject_count

    for row in body["scatter"]:
        assert row["usage_sufficient"] is True
        assert row["risk_score"] == row["usage_30d"] * row["gap"]

    assert len(body["top_risk"]) <= 15


async def test_governance_risk_priority_limit(client):
    resp = await client.get("/governance/risk-priority", params={"limit": 3})
    assert resp.status_code == 200
    assert len(resp.json()["top_risk"]) == 3


async def test_governance_ownership_coverage(client):
    resp = await client.get("/governance/ownership-coverage")
    assert resp.status_code == 200
    body = resp.json()
    assert 0 <= body["coverage_pct"] <= 100
    assert body["fully_covered"] <= body["total_subjects"]
    for role in ("DATA_OWNER", "DATA_STEWARD", "IT_OWNER"):
        assert role in body["role_coverage"]
        assert role in body["gaps"]
    assert len(body["by_domain"]) == 6


async def test_governance_stewardship(client):
    resp = await client.get("/governance/stewardship")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body["teams"], list)
    for t in body["teams"]:
        assert t["overdue_count"] <= t["open_count"]


async def test_governance_lineage_coverage(client):
    resp = await client.get("/governance/lineage-coverage")
    assert resp.status_code == 200
    body = resp.json()
    assert 0 <= body["coverage_pct"] <= 100
    subjects_resp = await client.get("/subjects")
    assert body["total_subjects"] == len(subjects_resp.json()["subjects"])
    assert body["covered"] + len(body["islands"]) == body["total_subjects"]


async def test_governance_subject_growth(client):
    resp = await client.get("/governance/subject-growth")
    assert resp.status_code == 200
    body = resp.json()
    assert body["window_days"] == 7
    assert body["flag_threshold"] == 3
    # seed.py backdates every subject 60-900 days -- none fall inside the
    # 7-day "new" window, so nothing should be flagged.
    assert body["new_subjects_total"] == 0
    assert body["flagged_domains"] == []
    assert len(body["domains"]) == 6
