import json
import os

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.datascrubbing import validate_pii_config_update


organization_slug = os.environ.get("PHASE7_SENTRY_ORG", "sentry")
project_slugs = [
    slug.strip()
    for slug in os.environ.get("PHASE7_SENTRY_PROJECTS", "frontend-poc").split(",")
    if slug.strip()
]
required_fields = json.loads(os.environ["PHASE7_SENSITIVE_FIELDS_JSON"])
required_pii_config = json.loads(os.environ["PHASE7_RELAY_PII_CONFIG_JSON"])
organization = Organization.objects.get(slug=organization_slug)
organization_fields = sorted(
    set(organization.get_option("sentry:sensitive_fields", []) or []) | set(required_fields)
)
organization.update_option("sentry:require_scrub_data", True)
organization.update_option("sentry:require_scrub_defaults", True)
organization.update_option("sentry:require_scrub_ip_address", True)
organization.update_option("sentry:sensitive_fields", organization_fields)

for project_slug in project_slugs:
    project = Project.objects.get(organization=organization, slug=project_slug)
    project_fields = sorted(
        set(project.get_option("sentry:sensitive_fields", []) or []) | set(required_fields)
    )
    existing_pii_config = json.loads(project.get_option("sentry:relay_pii_config", None) or "{}")
    existing_applications = existing_pii_config.get("applications") or {}
    required_applications = required_pii_config["applications"]
    merged_applications = {
        key: list(dict.fromkeys([
            *(existing_applications.get(key) or []),
            *applications,
        ]))
        for key, applications in {
            **existing_applications,
            **required_applications,
        }.items()
    }
    # user.id는 고객 식별자 연결을 위해 원본을 보존한다. 과거 제거 규칙도 함께 해제한다.
    merged_applications.pop("$user.id", None)
    merged_rules = {
        **(existing_pii_config.get("rules") or {}),
        **required_pii_config["rules"],
    }
    merged_rules.pop("phase7-remove-invalid-user-id-v1", None)
    merged_pii_config = {
        "rules": merged_rules,
        "applications": merged_applications,
    }
    merged_pii_config_json = json.dumps(merged_pii_config, separators=(",", ":"))
    validate_pii_config_update(organization, merged_pii_config_json)

    project.update_option("sentry:scrub_data", True)
    project.update_option("sentry:scrub_defaults", True)
    project.update_option("sentry:scrub_ip_address", True)
    project.update_option("sentry:sensitive_fields", project_fields)
    project.update_option("sentry:relay_pii_config", merged_pii_config_json)

    print(
        f"  관리 셸 적용 완료: organization={organization.slug}({len(organization_fields)}개), "
        f"project={project.slug}({len(project_fields)}개, advanced={len(merged_pii_config['applications'])}개)"
    )
