import json
import os

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.relay.datascrubbing import validate_pii_config_update


organization_slug = os.environ.get("PHASE7_SENTRY_ORG", "sentry")
project_slug = os.environ.get("PHASE7_SENTRY_PROJECT", "frontend-poc")
required_fields = json.loads(os.environ["PHASE7_SENSITIVE_FIELDS_JSON"])
required_pii_config = json.loads(os.environ["PHASE7_RELAY_PII_CONFIG_JSON"])
organization = Organization.objects.get(slug=organization_slug)
organization_fields = sorted(
    set(organization.get_option("sentry:sensitive_fields", []) or []) | set(required_fields)
)
project = Project.objects.get(organization=organization, slug=project_slug)
project_fields = sorted(
    set(project.get_option("sentry:sensitive_fields", []) or []) | set(required_fields)
)
existing_pii_config = json.loads(project.get_option("sentry:relay_pii_config", None) or "{}")
merged_pii_config = {
    "rules": {
        **(existing_pii_config.get("rules") or {}),
        **required_pii_config["rules"],
    },
    "applications": {
        key: list(dict.fromkeys([
            *((existing_pii_config.get("applications") or {}).get(key) or []),
            *applications,
        ]))
        for key, applications in {
            **(existing_pii_config.get("applications") or {}),
            **required_pii_config["applications"],
        }.items()
    },
}
merged_pii_config_json = json.dumps(merged_pii_config, separators=(",", ":"))
validate_pii_config_update(organization, merged_pii_config_json)

organization.update_option("sentry:require_scrub_data", True)
organization.update_option("sentry:require_scrub_defaults", True)
organization.update_option("sentry:require_scrub_ip_address", True)
organization.update_option("sentry:sensitive_fields", organization_fields)

project.update_option("sentry:scrub_data", True)
project.update_option("sentry:scrub_defaults", True)
project.update_option("sentry:scrub_ip_address", True)
project.update_option("sentry:sensitive_fields", project_fields)
project.update_option("sentry:relay_pii_config", merged_pii_config_json)

print(
    f"  관리 셸 적용 완료: organization={organization.slug}({len(organization_fields)}개), "
    f"project={project.slug}({len(project_fields)}개, advanced={len(merged_pii_config['applications'])}개)"
)
