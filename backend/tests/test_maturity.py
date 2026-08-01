async def test_maturity_summary(client):
    resp = await client.get("/maturity/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["latest"] is not None
    assert body["latest"]["scope_type"] == "GLOBAL"
    assert len(body["trend"]) == 52  # a full year of weekly snapshots


async def test_maturity_distribution(client):
    resp = await client.get("/maturity/distribution")
    assert resp.status_code == 200
    body = resp.json()
    assert body["max_level"] == 5
    assert [lvl["level"] for lvl in body["levels"]] == [1, 2, 3, 4, 5]
    # every subject lands in exactly one level bucket -- no L0, none dropped
    total = sum(lvl["count"] for lvl in body["levels"])
    subjects_resp = await client.get("/subjects")
    assert total == len(subjects_resp.json()["subjects"])
