# Contributing to LRI

Thank you for your interest in contributing to the Liminal Resonance Interface (LRI) project! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [RFC Process](#rfc-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Prioritize the community and project health
- Assume good intent

## How Can I Contribute?

### Reporting Bugs

- Check if the bug has already been reported in [Issues](https://github.com/lri/lri/issues)
- Use the bug report template
- Include reproduction steps, expected behavior, and actual behavior
- Add relevant labels (bug, sdk, spec, etc.)

### Suggesting Enhancements

- Check if the enhancement has been suggested
- Use the feature request template
- Explain the use case and benefits
- Consider if it fits LRI's scope and philosophy

### Good First Issues

Look for issues labeled `good first issue`:

- #2: Schema validation improvements
- #5: Node SDK documentation
- #22: README enhancements

### Major Changes (RFCs)

For significant changes, open an RFC (Request for Comments):

- Use the RFC template (`.github/ISSUE_TEMPLATE/rfc.md`)
- Discuss design before implementing
- Get consensus from maintainers
- See [RFC Process](#rfc-process) below

## Development Setup

### Prerequisites

- Node.js 18+ (for Node SDK)
- Python 3.9+ (for Python SDK)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/lri/lri.git
cd lri

# Node.js SDK
cd packages/node-lri
npm install
npm run build

# Python SDK
cd packages/python-lri
pip install -e ".[dev]"

# Run tests
npm test  # Node
pytest    # Python
```

### Project Structure

```
lri/
├── schemas/           # JSON schemas
├── vocab/            # Vocabularies (YAML)
├── packages/
│   ├── node-lri/     # Node.js SDK
│   └── python-lri/   # Python SDK
├── examples/         # Example applications
├── docs/             # Documentation
└── tools/            # CLI tools
```

## Coding Standards

### TypeScript (Node SDK)

- Use TypeScript strict mode
- Follow ESLint configuration
- Use Prettier for formatting
- Document public APIs with JSDoc

```typescript
/**
 * Validates LCE against JSON Schema
 *
 * @param lce - LCE object to validate
 * @returns Validation result with errors if invalid
 */
export function validateLCE(lce: unknown): ValidationResult {
  // ...
}
```

### Python (Python SDK)

- Follow PEP 8
- Use type hints (Python 3.9+)
- Use Ruff for linting
- Use Black for formatting
- Document with docstrings (Google style)

```python
def validate_lce(data: dict[str, Any]) -> Optional[list[dict[str, str]]]:
    """
    Validate LCE data against JSON Schema.

    Args:
        data: LCE data to validate

    Returns:
        List of validation errors, or None if valid
    """
    # ...
```

### JSON/YAML

- Indent with 2 spaces
- Use meaningful keys
- Validate against schemas
- Include examples

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, no code change
- `refactor`: Code refactoring
- `test`: Add or update tests
- `chore`: Build, CI, dependencies

**Examples:**

```
feat(node-sdk): add WebSocket support

Implement LHS handshake sequence for WebSocket connections.
Includes server and client adapters.

Closes #7
```

```
fix(python-sdk): handle missing LCE header gracefully

Previously threw exception, now returns None when header is absent
and required=False.

Fixes #42
```

### Commit Guidelines

- One logical change per commit
- Write clear, descriptive messages
- Reference issues/PRs in footer
- Sign commits (optional but recommended)

## Pull Request Process

### Before Opening a PR

1. **Fork the repository** and create a feature branch
2. **Make your changes** following coding standards
3. **Add tests** for new functionality
4. **Update documentation** (README, API docs, etc.)
5. **Run tests locally** to ensure they pass
6. **Run linters** to check code style

### Opening a PR

1. **Title:** Clear and descriptive (e.g., "feat: Add CBOR encoding support")
2. **Description:** Explain what, why, and how
   - Link related issues
   - Describe breaking changes
   - Include screenshots/examples if relevant
3. **Labels:** Add appropriate labels (enhancement, bug, docs, etc.)
4. **Reviewers:** Request review from maintainers

### PR Template

```markdown
## Description
Brief description of changes

## Related Issues
Closes #123

## Changes Made
- Change 1
- Change 2

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing performed

## Documentation
- [ ] README updated
- [ ] API docs updated
- [ ] CHANGELOG updated

## Breaking Changes
None / List breaking changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
```

### Review Process

- At least one maintainer approval required
- CI must pass (lint, test, build)
- Address review feedback promptly
- Squash commits before merging (optional)

## RFC Process

For major changes (new features, protocol changes, breaking changes):

### 1. Draft RFC

- Use RFC template (`.github/ISSUE_TEMPLATE/rfc.md`)
- Assign RFC number (RFC-XXX)
- Label: `rfc`, `spec`

### 2. Discussion Period

- Minimum 1 week for community feedback
- Address questions and concerns
- Iterate on design

### 3. Decision

- Maintainers vote: Accept, Reject, or Defer
- Document decision rationale
- Update RFC status

### 4. Implementation

- Break into smaller issues
- Implement with tests and docs
- Update RFC with final design

## Testing

### Node.js SDK

```bash
cd packages/node-lri
npm test                 # Run all tests
npm test -- --watch     # Watch mode
npm run test:coverage   # Coverage report
```

### Python SDK

```bash
cd packages/python-lri
pytest                   # Run all tests
pytest --cov            # Coverage report
pytest -k test_name     # Run specific test
```

### Schema Validation

```bash
# Validate examples against schema
ajv validate -s schemas/lce-v0.1.json -d "schemas/examples/*.json"
```

## Documentation

### Types of Documentation

1. **Code comments** - For complex logic
2. **API documentation** - For public interfaces (JSDoc, docstrings)
3. **README files** - For packages and examples
4. **Guides** - In `/docs` directory
5. **RFCs** - For design decisions

### Writing Good Docs

- **Clear and concise** - Avoid jargon
- **Examples** - Show, don't just tell
- **Up-to-date** - Update docs with code changes
- **Structured** - Use headings, lists, code blocks
- **Audience-aware** - Consider reader's knowledge level

### Documentation Checklist

When adding a feature:

- [ ] Add/update API documentation (JSDoc/docstrings)
- [ ] Update README if user-facing
- [ ] Add usage examples
- [ ] Update CHANGELOG
- [ ] Add to migration guide if breaking

## Project Governance

### Roles

- **Contributors** - Anyone who contributes (code, docs, issues)
- **Committers** - Regular contributors with write access
- **Maintainers** - Lead project direction and make final decisions
- **BDFL** - Benevolent Dictator For Life (tie-breaker)

### Decision Making

- **Minor changes** - Any committer can merge
- **Major changes** - Require RFC and maintainer consensus
- **Breaking changes** - Require broad consensus and migration plan

## Getting Help

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and ideas
- **Discord** - Coming soon for real-time chat

## Issue Labels

- `good first issue` - Easy for newcomers
- `help wanted` - Maintainers need help
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `spec` - Specification/protocol changes
- `sdk` - SDK implementation
- `docs` - Documentation improvements
- `security` - Security-related issues
- `rfc` - Request for Comments
- `wontfix` - Will not be fixed/implemented

## Milestones

- **v0.1.0** - Core spec + basic SDKs (Q1 2025)
- **v0.2.0** - WebSocket + Crypto (Q2 2025)
- **v1.0.0** - Production ready (Q3 2025)

## Recognition

Contributors are recognized in:

- `CONTRIBUTORS.md` file
- Release notes
- Project website (coming soon)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to LRI! Together we're building the future of human-AI communication.

**Questions?** Open a [discussion](https://github.com/lri/lri/discussions) or reach out to maintainers.
