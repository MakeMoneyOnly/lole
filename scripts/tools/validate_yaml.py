import yaml
import sys

try:
    with open('c:/Users/user/Desktop/lole/.github/workflows/ci.yml', 'r') as f:
        yaml.safe_load(f)
    print("ci.yml is valid YAML")
except Exception as e:
    print(f"ci.yml error: {e}")

try:
    with open('c:/Users/user/Desktop/lole/.github/workflows/policy-hardening-integration-tests.yml', 'r') as f:
        yaml.safe_load(f)
    print("policy-hardening-integration-tests.yml is valid YAML")
except Exception as e:
    print(f"policy-hardening-integration-tests.yml error: {e}")
