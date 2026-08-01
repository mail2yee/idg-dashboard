# DOMAINS is a fixed constant in seed.py -- safe to hardcode a member here,
# unlike a subject's ObjectId which is never hardcoded in this suite.
KNOWN_DOMAIN = "Finance"


async def test_domains_ranking(client):
    resp = await client.get("/domains/ranking")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["domains"]) == 6
    d = body["domains"][0]
    assert "domain" in d and "avg_maturity_level" in d


async def test_domains_trend_summary_year(client):
    resp = await client.get("/domains/trend-summary", params={"period": "year"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["domains"]) == 6
    d = body["domains"][0]
    for key in ("wow_delta", "mom_delta", "yoy_delta", "delta", "series"):
        assert key in d


async def test_domains_level_distribution(client):
    resp = await client.get("/domains/level-distribution")
    assert resp.status_code == 200
    body = resp.json()
    assert body["min_level"] == 1
    assert body["max_level"] == 5
    # every date's per-level counts across L1-L5 sum to the domain count (6)
    dates = body["dates"]
    for i in range(len(dates)):
        total = sum(body["series"][str(lvl)][i] for lvl in range(1, 6))
        assert total == 6


async def test_domains_dimension_breakdown(client):
    resp = await client.get("/domains/dimension-breakdown")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["domains"]) == 6
    row = body["domains"][0]
    assert "domain" in row
    # 5 dimension keys + "domain" itself
    assert len(row) == 6


async def test_domain_detail(client):
    resp = await client.get(f"/domains/{KNOWN_DOMAIN}/detail", params={"period": "month"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["domain"] == KNOWN_DOMAIN
    assert len(body["subjects"]) > 0
    assert "avg_sub_scores" in body


async def test_domain_detail_not_found(client):
    resp = await client.get("/domains/NotARealDomain/detail")
    assert resp.status_code == 404
