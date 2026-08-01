async def test_owner_teams_trend_summary(client):
    resp = await client.get("/owner-teams/trend-summary")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["teams"]) > 0
    t = body["teams"][0]
    for key in ("team", "avg_maturity_level", "wow_delta", "mom_delta", "yoy_delta", "delta", "subject_count"):
        assert key in t


async def test_owner_team_detail(client):
    listing = await client.get("/owner-teams/trend-summary")
    team_name = listing.json()["teams"][0]["team"]

    resp = await client.get(f"/owner-teams/{team_name}/detail", params={"period": "month"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["team"] == team_name
    assert len(body["subjects"]) > 0
    assert "avg_sub_scores" in body


async def test_owner_team_detail_not_found(client):
    resp = await client.get("/owner-teams/Not A Real Team/detail")
    assert resp.status_code == 404
