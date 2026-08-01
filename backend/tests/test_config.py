async def test_config_dimensions(client):
    resp = await client.get("/config/dimensions")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["dimensions"]) == 5
    d = body["dimensions"][0]
    assert "key" in d and "label" in d


async def test_config_levels(client):
    resp = await client.get("/config/levels")
    assert resp.status_code == 200
    body = resp.json()
    assert body["max_level"] == 5
    assert len(body["levels"]) == 5
    assert [lvl["level"] for lvl in body["levels"]] == [1, 2, 3, 4, 5]
