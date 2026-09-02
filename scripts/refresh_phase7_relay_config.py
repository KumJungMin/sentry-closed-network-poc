import json
import os

from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.relay import projectconfig_cache
from sentry.tasks.relay import compute_projectkey_config


organization_slug = os.environ.get("PHASE7_SENTRY_ORG", "sentry")
project_slug = os.environ.get("PHASE7_SENTRY_PROJECT", "frontend-poc")
required_pii_config = json.loads(os.environ["PHASE7_RELAY_PII_CONFIG_JSON"])
required_selectors = set(required_pii_config["applications"])

project = Project.objects.get(
    organization__slug=organization_slug,
    slug=project_slug,
)

# 관리 shell은 web/taskworker와 별도 프로세스다. 공유 ProjectOption cache를 DB의
# 최신 값으로 다시 만든 뒤 Relay가 읽는 full project config cache도 강제로 갱신한다.
ProjectOption.objects.reload_cache(project.id, "projectoption.get_all_values")

configs = {}
for project_key in ProjectKey.objects.filter(project=project):
    project_key.set_cached_field_value("project", project)
    configs[project_key.public_key] = compute_projectkey_config(project_key)

if not configs:
    raise RuntimeError(f"활성 project key를 찾지 못했습니다: {organization_slug}/{project_slug}")

projectconfig_cache.backend.set_many(configs)

for config in configs.values():
    applications = config.get("config", {}).get("piiConfig", {}).get("applications", {})
    missing_selectors = sorted(required_selectors - set(applications))
    if missing_selectors:
        raise RuntimeError(
            "Relay project config cache에 selector가 누락됐습니다: "
            + ", ".join(missing_selectors)
        )

print(
    f"  Relay project config cache 갱신 완료: project={project.slug}, "
    f"keys={len(configs)}개, selectors={len(required_selectors)}개"
)
