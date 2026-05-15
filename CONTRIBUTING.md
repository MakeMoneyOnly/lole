# Contributing to lole

Thank you for your interest in contributing to lole! This document provides guidelines and instructions for contributing.

## 1. Development Environment Setup

### Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 10.0.0
- **Docker** (for Supabase local development)

### Setup Steps

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd lole
    ```

2. **Install dependencies**

    ```bash
    pnpm install
    ```

3. **Set up environment variables**

    ```bash
    cp .env.local.example .env.local
    # Fill in required values
    ```

4. **Set up Supabase**

    ```bash
    # Use Supabase CLI for local development
    pnpm supabase:cli db push
    ```

5. **Run the development server**

    ```bash
    pnpm dev
    ```

    The application will be available at http://localhost:4000

## 2. Code Standards

All code must follow the standards defined in our [coding standards document](docs/10-reference/coding-standards.md).

Key references:

- **TypeScript standards** - Type safety, definitions, return types
- **React standards** - Component structure, hooks rules, organization
- **Next.js standards** - Server/Client components, Server Actions, API routes
- **Naming conventions** - Files, code, database naming patterns
- **Security checklist** - Required validation before merging

## 3. Git Workflow

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Formatting changes (no code change)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Scopes:**

- `api` - API routes
- `kds` - Kitchen display system
- `guest` - Guest ordering
- `merchant` - Merchant dashboard
- `auth` - Authentication
- `db` - Database

**Examples:**

```
feat(kds): add order acknowledgment feature
fix(api): resolve rate limiting bypass issue
docs(readme): update installation instructions
```

### Branch Names

- Feature: `feat/description`
- Fix: `fix/description`
- Release: `release/v1.0.0`
- Hotfix: `hotfix/description`

## 4. Pull Request Process

1. **Create a feature branch** from `main`

    ```bash
    git checkout -b feat/your-feature-name
    ```

2. **Make your changes** following the code standards

3. **Ensure all checks pass**

    ```bash
    pnpm lint
    pnpm type-check
    pnpm test:coverage
    ```

4. **Commit with conventional commits** format

5. **Push and create a pull request**

6. **PR Requirements:**
    - All CI checks must pass
    - Code coverage must meet thresholds (80% for lines/functions/statements, 70% for branches)
    - At least one approval from a team member
    - All security checklist items verified

7. **After merge**, delete your branch

## 5. Testing Requirements

### Run Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e
```

### Coverage Requirements

| Metric     | Target |
| ---------- | ------ |
| Lines      | 80%    |
| Functions  | 80%    |
| Statements | 80%    |
| Branches   | 70%    |

### Writing Tests

- Use Vitest for unit tests
- Use React Testing Library for component tests
- Use Playwright for E2E tests
- Follow the testing patterns in `docs/10-reference/coding-standards.md`

## 6. Linting and Type Checking

### Run Linting

```bash
# Check for linting errors
pnpm lint

# Auto-fix linting errors
pnpm lint --fix
```

### Run Type Checking

```bash
pnpm type-check
```

### Run All Checks (CI)

```bash
pnpm test:ci
```

This runs linting, type checking, unit tests with coverage, and E2E tests.

### Formatting

```bash
# Format code
pnpm format

# Check formatting
pnpm format:check
```

## Questions?

If you have questions about contributing, please open an issue with the `question` label.
