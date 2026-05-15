with open('c:/Users/user/Desktop/lole/.github/workflows/ci.yml', 'rb') as f:
    content = f.read()
    print(f"File size: {len(content)}")
    # Print first 100 chars as hex
    print(content[:100].hex())
