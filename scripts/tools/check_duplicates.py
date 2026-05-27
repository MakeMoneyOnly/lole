import yaml
import sys

def check_duplicates(file_path):
    class UniqueKeyLoader(yaml.SafeLoader):
        def construct_mapping(self, node, deep=False):
            mapping = set()
            for key_node, value_node in node.value:
                key = self.construct_object(key_node, deep=deep)
                if key in mapping:
                    print(f"Duplicate key found: {key}")
                mapping.add(key)
            return super().construct_mapping(node, deep)

    try:
        with open(file_path, 'r') as f:
            yaml.load(f, Loader=UniqueKeyLoader)  # nosec B506
        print(f"{file_path} is checked for duplicates.")
    except Exception as e:
        print(f"Error in {file_path}: {e}")

check_duplicates('c:/Users/user/Desktop/lole/.github/workflows/ci.yml')
check_duplicates('c:/Users/user/Desktop/lole/.github/workflows/policy-hardening-integration-tests.yml')
