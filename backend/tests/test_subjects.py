async def test_list_subjects(client):
    resp = await client.get("/subjects")
    assert resp.status_code == 200
    body = resp.json()
    assert "subjects" in body
    assert len(body["subjects"]) > 0
    s = body["subjects"][0]
    assert "id" in s and "name" in s and "domain" in s and "maturity_level" in s


async def test_list_subjects_domain_filter(client):
    resp = await client.get("/subjects", params={"domain": "Finance"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["subjects"]) > 0
    assert all(s["domain"] == "Finance" for s in body["subjects"])


async def test_subjects_trend_summary(client):
    resp = await client.get("/subjects/trend-summary")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["subjects"]) > 0
    s = body["subjects"][0]
    for key in ("wow_delta", "mom_delta", "yoy_delta", "delta", "series"):
        assert key in s


async def test_subjects_level_distribution(client):
    resp = await client.get("/subjects/level-distribution")
    assert resp.status_code == 200
    body = resp.json()
    assert body["min_level"] == 1
    assert body["max_level"] == 5
    assert set(body["series"].keys()) == {"1", "2", "3", "4", "5"}
    assert len(body["dates"]) == len(body["series"]["1"])


async def test_subject_detail_and_trend(client):
    listing = await client.get("/subjects")
    subject_id = listing.json()["subjects"][0]["id"]

    resp = await client.get(f"/subjects/{subject_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["subject"]["id"] == subject_id
    for key in ("snapshot", "assertions", "incidents", "lineage", "schema_fields"):
        assert key in body

    trend = await client.get(f"/subjects/{subject_id}/trend", params={"period": "month"})
    assert trend.status_code == 200
    assert len(trend.json()["trend"]) > 0


async def test_subject_detail_invalid_id(client):
    resp = await client.get("/subjects/not-a-valid-objectid")
    assert resp.status_code == 400


async def test_subject_detail_not_found(client):
    resp = await client.get("/subjects/000000000000000000000000")
    assert resp.status_code == 404
