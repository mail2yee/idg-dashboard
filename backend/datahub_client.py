"""
Thin GraphQL client for reading metadata back out of DataHub. Used by
datahub_sync.py. Same os.environ.get(...) config pattern as app/db.py and
app/agent/ollama_client.py -- no new settings framework.
"""

import os

import requests

GMS_URL = os.environ.get("DATAHUB_GMS_URL", "http://localhost:8080")
TOKEN = os.environ.get("DATAHUB_TOKEN", "")


def graphql(query: str, variables: dict = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    resp = requests.post(
        f"{GMS_URL}/api/graphql",
        json={"query": query, "variables": variables or {}},
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    if body.get("errors"):
        raise RuntimeError(f"GraphQL errors for query: {body['errors']}")
    return body["data"]
