"""
Pushes our synthetic data-governance scenario INTO a real DataHub instance,
as real entities/aspects -- via the official Python SDK
(https://docs.datahub.com/docs/metadata-ingestion/as-a-library), not
hand-written JSON. This replaces seed.py's "build a dict, write it straight
to Mongo" approach for the current-state metadata; datahub_sync.py (a
separate script) is what reads it back out of DataHub into Mongo afterwards.

Run with the dedicated venv that has the DataHub SDK:
    backend/.venv-datahub/bin/python3 datahub_ingest.py

Incidents are emitted as a raw `incidentInfo` MCP aspect rather than through
the `raiseIncident` GraphQL mutation -- the mutation always stamps "now" as
the creation time, which would make every incident look freshly opened.
Emitting the aspect directly lets `created`/`status.lastUpdated` be
backdated, matching seed.py's existing age/resolution-time distribution.

Lineage is only emitted as "upstream" pointers (DataHub's actual model --
"downstream" isn't a separate aspect, it's inferred from who points at you)
-- simpler and more correct than seed.py's independent random up/down edges.
"""

import random
import time
import uuid

from datahub.emitter.mcp import MetadataChangeProposalWrapper
from datahub.emitter.rest_emitter import DatahubRestEmitter
from datahub.metadata.schema_classes import (
    AssertionInfoClass,
    AssertionResultClass,
    AssertionResultTypeClass,
    AssertionRunEventClass,
    AssertionRunStatusClass,
    AssertionStdOperatorClass,
    AssertionTypeClass,
    AuditStampClass,
    CorpUserInfoClass,
    DatasetAssertionInfoClass,
    DatasetAssertionScopeClass,
    DatasetPropertiesClass,
    DatasetUsageStatisticsClass,
    DomainPropertiesClass,
    DomainsClass,
    GlobalTagsClass,
    GlossaryTermAssociationClass,
    GlossaryTermInfoClass,
    GlossaryTermsClass,
    IncidentInfoClass,
    IncidentStateClass,
    IncidentStatusClass,
    IncidentTypeClass,
    OperationClass,
    OperationTypeClass,
    OtherSchemaClass,
    OwnerClass,
    OwnershipClass,
    OwnershipTypeClass,
    SchemaFieldClass,
    SchemaFieldDataTypeClass,
    SchemaMetadataClass,
    StringTypeClass,
    TagAssociationClass,
    TagPropertiesClass,
    UpstreamClass,
    UpstreamLineageClass,
)

from seed import (
    ASSERTION_TYPES,
    DOMAINS,
    IT_TEAM,
    NATIVE_TYPES,
    PLATFORMS,
    TABLE_PREFIXES,
    business_team_for,
    fake,
)

GMS_URL = "http://localhost:8080"
SUBJECTS_PER_DOMAIN = 7
GLOSSARY_TERMS = ["Revenue", "Order", "Customer", "Campaign", "Risk Score", "Inventory"]
TAG_CHOICES = ["pii", "critical", "gold", "silver", "bronze"]
HAS_API_TAG = "has-api"
INCIDENT_CATEGORIES = ["Data Quality", "Pipeline Failure", "Schema Change", "Access Issue"]

OWNERSHIP_TYPE_BY_ROLE = {
    "DATA_OWNER": OwnershipTypeClass.DATAOWNER,
    "DATA_STEWARD": OwnershipTypeClass.DATA_STEWARD,
    "IT_OWNER": OwnershipTypeClass.TECHNICAL_OWNER,
}

emitter = DatahubRestEmitter(GMS_URL)


def now_ms() -> int:
    return int(time.time() * 1000)


def audit_stamp(days_ago: int = 0, actor: str = "urn:li:corpuser:datahub_ingest") -> AuditStampClass:
    return AuditStampClass(time=now_ms() - days_ago * 86_400_000, actor=actor)


def emit(entity_urn: str, aspect) -> None:
    emitter.emit(MetadataChangeProposalWrapper(entityUrn=entity_urn, aspect=aspect))


def ingest_domains():
    urns = {}
    for domain in DOMAINS:
        urn = f"urn:li:domain:{domain.lower()}"
        emit(urn, DomainPropertiesClass(name=domain, description=f"{domain} 部門 / Product Suite"))
        urns[domain] = urn
    return urns


def ingest_glossary_terms():
    urns = {}
    for term in GLOSSARY_TERMS:
        urn = f"urn:li:glossaryTerm:{term.replace(' ', '')}"
        emit(urn, GlossaryTermInfoClass(name=term, definition=f"{term} 相關業務詞彙", termSource="INTERNAL"))
        urns[term] = urn
    return urns


def ingest_tags():
    for tag in TAG_CHOICES + [HAS_API_TAG]:
        emit(f"urn:li:tag:{tag}", TagPropertiesClass(name=tag))


def make_owners(domain: str):
    """DataHub's Ownership aspect has no "team" concept on an owner -- team
    is our own accountability grouping, so it's stored as departmentName on
    each owner's own CorpUserInfo (a real DataHub field), not on the
    ownership edge itself. datahub_sync.py reads it back from there."""
    business_team = business_team_for(domain)
    owners = []
    if random.random() < 0.90:
        owners.append({"urn": f"urn:li:corpuser:{fake.user_name()}", "role": "DATA_OWNER", "team": business_team})
    if random.random() < 0.75:
        owners.append({"urn": f"urn:li:corpuser:{fake.user_name()}", "role": "DATA_STEWARD", "team": business_team})
    if random.random() < 0.80:
        owners.append({"urn": f"urn:li:corpuser:{fake.user_name()}", "role": "IT_OWNER", "team": IT_TEAM})
    for o in owners:
        username = o["urn"].split(":")[-1]
        # Derived from the username, not fake.name()/fake.email() -- those
        # would consume additional Faker draws and shift every subsequent
        # random choice, breaking idempotent re-runs against already-ingested
        # datasets (same seed would then produce different dataset names).
        emit(
            o["urn"],
            CorpUserInfoClass(
                active=True, fullName=username, email=f"{username}@example.com", departmentName=o["team"]
            ),
        )
    return owners


def ingest_subject_core(domain: str, domain_urn: str, glossary_urns: dict):
    prefix = random.choice(TABLE_PREFIXES)
    name = f"{prefix}_{fake.word()}_{fake.word()}"
    platform = random.choice(PLATFORMS)
    dataset_urn = f"urn:li:dataset:(urn:li:dataPlatform:{platform},{domain.lower()}.{name},PROD)"
    description = fake.sentence() if random.random() < 0.75 else ""
    has_api = random.random() < 0.5
    freshness_days = random.choice([0, 1, 2, 3, 5, 8, 14, 21])

    emit(dataset_urn, DatasetPropertiesClass(name=name, description=description))
    emit(dataset_urn, DomainsClass(domains=[domain_urn]))

    owners = make_owners(domain)
    if owners:
        emit(
            dataset_urn,
            OwnershipClass(
                owners=[OwnerClass(owner=o["urn"], type=OWNERSHIP_TYPE_BY_ROLE[o["role"]]) for o in owners]
            ),
        )

    tags = random.sample(TAG_CHOICES, k=random.randint(0, 2))
    if has_api:
        tags.append(HAS_API_TAG)
    if tags:
        emit(dataset_urn, GlobalTagsClass(tags=[TagAssociationClass(tag=f"urn:li:tag:{t}") for t in tags]))

    glossary_terms = random.sample(GLOSSARY_TERMS, k=random.randint(0, 2))
    if glossary_terms:
        emit(
            dataset_urn,
            GlossaryTermsClass(
                terms=[GlossaryTermAssociationClass(urn=glossary_urns[t]) for t in glossary_terms],
                auditStamp=audit_stamp(),
            ),
        )

    n_fields = random.randint(5, 15)
    fields = []
    used_paths = set()
    for i in range(n_fields):
        has_desc = random.random() < 0.7
        field_path = fake.word() + ("_id" if i == 0 else "")
        attempts = 0
        while field_path in used_paths and attempts < 20:
            field_path = fake.word() + f"_{i}"
            attempts += 1
        used_paths.add(field_path)
        fields.append(
            SchemaFieldClass(
                fieldPath=field_path,
                type=SchemaFieldDataTypeClass(type=StringTypeClass()),
                nativeDataType=random.choice(NATIVE_TYPES),
                description=fake.sentence() if has_desc else None,
                nullable=i != 0 and random.random() < 0.4,
            )
        )
    emit(
        dataset_urn,
        SchemaMetadataClass(
            schemaName=name,
            platform=f"urn:li:dataPlatform:{platform}",
            version=0,
            hash="",
            platformSchema=OtherSchemaClass(rawSchema=""),
            fields=fields,
        ),
    )

    emit(
        dataset_urn,
        OperationClass(
            timestampMillis=now_ms(),
            operationType=OperationTypeClass.UPDATE,
            lastUpdatedTimestamp=now_ms() - freshness_days * 86_400_000,
        ),
    )

    return {"name": name, "urn": dataset_urn, "domain": domain, "owners": owners}


def ingest_lineage(all_subjects):
    for subject in all_subjects:
        if random.random() < 0.15:
            continue  # intentional orphan, matches seed.py's orphan rate
        others = [s for s in all_subjects if s["urn"] != subject["urn"]]
        n = random.randint(0, 2)
        if n == 0 or not others:
            continue
        upstreams = [
            UpstreamClass(dataset=u["urn"], type="TRANSFORMED")
            for u in random.sample(others, k=min(n, len(others)))
        ]
        emit(subject["urn"], UpstreamLineageClass(upstreams=upstreams))


def ingest_assertions(subject):
    """Only today's run event -- the user's real DataHub instance doesn't
    have timeseries retention enabled, so this app can only ever see "did it
    pass right now", never a historical run history. datahub_sync.py reads
    just this one point; refresh.py is what accumulates a pass/fail history
    over time in our own DB across repeated scheduled runs."""
    n = random.choices([0, 1, 2], weights=[0.3, 0.4, 0.3])[0]
    baseline = random.uniform(0.5, 0.99)
    for i in range(n):
        # deterministic (derived from dataset urn + index), not uuid4() --
        # re-running ingestion must upsert the same assertion entities, not
        # keep creating new ones every time.
        seed_key = f"{subject['urn']}#assertion#{i}"
        assertion_urn = f"urn:li:assertion:{uuid.uuid5(uuid.NAMESPACE_URL, seed_key)}"
        emit(
            assertion_urn,
            AssertionInfoClass(
                type=AssertionTypeClass.DATASET,
                datasetAssertion=DatasetAssertionInfoClass(
                    dataset=subject["urn"],
                    scope=DatasetAssertionScopeClass.DATASET_ROWS,
                    operator=AssertionStdOperatorClass.NOT_NULL,
                ),
                description=f"{random.choice(ASSERTION_TYPES)} check on {subject['name']}",
            ),
        )
        passed = random.random() < baseline
        emit(
            assertion_urn,
            AssertionRunEventClass(
                timestampMillis=now_ms(),
                runId=str(uuid.uuid4()),
                asserteeUrn=subject["urn"],
                status=AssertionRunStatusClass.COMPLETE,
                assertionUrn=assertion_urn,
                result=AssertionResultClass(
                    type=AssertionResultTypeClass.SUCCESS if passed else AssertionResultTypeClass.FAILURE
                ),
            ),
        )


def ingest_usage_stats(subject):
    """Only today's usage point, for the same reason as ingest_assertions --
    no timeseries retention in the real target environment means no 30-day
    window is available from DataHub, only "how much was it queried today"."""
    pop = random.choices(["hot", "warm", "cold", "zero"], weights=[0.2, 0.3, 0.35, 0.15])[0]
    pop_map = {"hot": (20, 80, 20, 60), "warm": (3, 15, 3, 15), "cold": (0, 3, 0, 2), "zero": (0, 0, 0, 0)}
    lo_q, hi_q, lo_u, hi_u = pop_map[pop]
    emit(
        subject["urn"],
        DatasetUsageStatisticsClass(
            timestampMillis=now_ms(),
            totalSqlQueries=random.randint(lo_q, hi_q) if hi_q else 0,
            uniqueUserCount=random.randint(lo_u, hi_u) if hi_u else 0,
        ),
        )


def ingest_incidents(subject):
    n = random.choices([0, 1, 2], weights=[0.6, 0.3, 0.1])[0]
    for i in range(n):
        seed_key = f"{subject['urn']}#incident#{i}"
        incident_urn = f"urn:li:incident:{uuid.uuid5(uuid.NAMESPACE_URL, seed_key)}"
        created_days_ago = random.randint(1, 60)
        resolved = random.random() < 0.7
        resolved_days_ago = created_days_ago - random.randint(0, min(created_days_ago, 4)) if resolved else None

        status = (
            IncidentStatusClass(state=IncidentStateClass.RESOLVED, lastUpdated=audit_stamp(resolved_days_ago))
            if resolved
            else IncidentStatusClass(state=IncidentStateClass.ACTIVE, lastUpdated=audit_stamp(created_days_ago))
        )
        emit(
            incident_urn,
            IncidentInfoClass(
                type=IncidentTypeClass.OPERATIONAL,
                entities=[subject["urn"]],
                status=status,
                created=audit_stamp(created_days_ago),
                title=f"{random.choice(INCIDENT_CATEGORIES)} on {subject['name']}",
            ),
        )


def main():
    print("Ingesting domains + glossary terms + tags...")
    domain_urns = ingest_domains()
    glossary_urns = ingest_glossary_terms()
    ingest_tags()

    all_subjects = []
    for domain in DOMAINS:
        print(f"Ingesting domain: {domain}")
        for _ in range(SUBJECTS_PER_DOMAIN):
            subject = ingest_subject_core(domain, domain_urns[domain], glossary_urns)
            all_subjects.append(subject)
            print(f"  {subject['name']} -> {subject['urn']}")

    print("Ingesting lineage...")
    ingest_lineage(all_subjects)

    print("Ingesting assertions, usage stats, incidents (current-state only, one point each)...")
    for i, subject in enumerate(all_subjects):
        ingest_assertions(subject)
        ingest_usage_stats(subject)
        ingest_incidents(subject)
        if (i + 1) % 10 == 0:
            print(f"  {i + 1}/{len(all_subjects)} subjects done")

    print(f"Done. {len(all_subjects)} subjects ingested. Check http://localhost:9002")


if __name__ == "__main__":
    main()
