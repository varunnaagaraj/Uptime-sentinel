"""
Config Validator - JSON Schema validation with fail-fast semantics.
Uses jsonschema with strict validation. Process exits on invalid config.
"""
import json
import os
import logging
from pathlib import Path
from jsonschema import validate, ValidationError, Draft202012Validator

logger = logging.getLogger(__name__)

SCHEMA_PATH = Path(__file__).parent.parent / "config" / "config_schema.json"
CONFIG_PATH = Path(__file__).parent.parent / "config" / "monitor_config.json"


def load_schema():
    with open(SCHEMA_PATH, "r") as f:
        return json.load(f)


def load_config(path=None):
    config_path = Path(path) if path else CONFIG_PATH
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    with open(config_path, "r") as f:
        return json.load(f)


def validate_config(config: dict) -> list:
    """Validate config against schema. Returns list of errors (empty = valid)."""
    schema = load_schema()
    validator = Draft202012Validator(schema)
    errors = []
    for error in sorted(validator.iter_errors(config), key=lambda e: list(e.absolute_path)):
        errors.append({
            "path": ".".join(str(p) for p in error.absolute_path) or "(root)",
            "message": error.message,
        })
    return errors


def validate_config_strict(config: dict):
    """Validate and fail fast. Raises on invalid config."""
    errors = validate_config(config)
    if errors:
        for e in errors:
            logger.error(f"Config validation error at {e['path']}: {e['message']}")
        raise ValueError(f"Config validation failed with {len(errors)} error(s)")
    return True


def resolve_env_credentials(config: dict) -> dict:
    """Resolve environment variable references in config. Returns warnings for missing vars."""
    warnings = []
    for target in config.get("targets", []):
        auth = target.get("auth", {})
        strategy = auth.get("strategy", "none")

        if strategy == "form":
            form = auth.get("formLogin", {})
            for key in ["usernameEnvVar", "passwordEnvVar"]:
                env_var = form.get(key)
                if env_var and not os.environ.get(env_var):
                    warnings.append(f"Target '{target['id']}': Missing env var '{env_var}' for form auth")

        elif strategy == "oauth":
            oauth = auth.get("oauth", {})
            for key in ["clientIdEnvVar", "clientSecretEnvVar"]:
                env_var = oauth.get(key)
                if env_var and not os.environ.get(env_var):
                    warnings.append(f"Target '{target['id']}': Missing env var '{env_var}' for OAuth")

    alerting = config.get("alerting", {})
    slack = alerting.get("slack", {})
    if slack.get("enabled"):
        env_var = slack.get("webhookUrlEnvVar")
        if env_var and not os.environ.get(env_var):
            warnings.append(f"Slack enabled but missing env var '{env_var}'")

    email = alerting.get("email", {})
    if email.get("enabled"):
        for key in ["smtpHostEnvVar", "smtpPortEnvVar", "smtpUserEnvVar", "smtpPassEnvVar"]:
            env_var = email.get(key)
            if env_var and not os.environ.get(env_var):
                warnings.append(f"Email enabled but missing env var '{env_var}'")

    return warnings


def sanitize_config_for_display(config: dict) -> dict:
    """Remove sensitive env var references for dashboard display."""
    import copy
    sanitized = copy.deepcopy(config)

    for target in sanitized.get("targets", []):
        auth = target.get("auth", {})
        if auth.get("formLogin"):
            for key in ["usernameEnvVar", "passwordEnvVar"]:
                if key in auth["formLogin"]:
                    auth["formLogin"][key] = "***REDACTED***"
        if auth.get("oauth"):
            for key in ["clientIdEnvVar", "clientSecretEnvVar"]:
                if key in auth["oauth"]:
                    auth["oauth"][key] = "***REDACTED***"

    alerting = sanitized.get("alerting", {})
    if alerting.get("slack", {}).get("webhookUrlEnvVar"):
        alerting["slack"]["webhookUrlEnvVar"] = "***REDACTED***"
    if alerting.get("email"):
        for key in ["smtpHostEnvVar", "smtpPortEnvVar", "smtpUserEnvVar", "smtpPassEnvVar"]:
            if key in alerting.get("email", {}):
                alerting["email"][key] = "***REDACTED***"

    return sanitized
