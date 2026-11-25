
# Security Policy

## Project Scope

Sentinel AI is a local-first cybersecurity intelligence
platform designed for defensive security research,
educational use, and authorised security analysis.

The application is intended for trusted, single-user
environments and is not designed for public-facing
or multi-tenant production deployment.

## Supported Versions

| Version | Status |
|---|---|
| 1.0 | Upcoming release |
| 0.9 | Current development baseline |
| 0.8 and earlier | Historical development versions |

Security improvements are prioritised for the latest
version of Sentinel AI.

## Implemented Security Controls

### API Security

- Trusted Host header validation.
- Trusted browser origin validation.
- Cross-site request restrictions.
- Maximum request body size of 1 MiB.
- Content-Length validation.
- Request body framing validation.
- HTTP security response headers.
- Pydantic request validation.
- Localhost-only startup configuration.

### Database Security

- Parameterized SQL queries.
- Foreign key enforcement.
- Atomic conversation transactions.
- Transaction rollback on storage failures.
- Explicit opt-in history persistence.
- Database exclusion from Git tracking.
- Database integrity diagnostics.

### AI Security

- Separation of trusted system instructions
  and untrusted investigation data.
- Conversation role validation.
- Bounded conversation context.
- Structured JSON investigation payloads.
- Investigation input size restrictions.
- Advisory-only language model functionality.

The language model is not provided with tools to
execute commands, modify firewall rules, or perform
external network operations.

Prompt injection and hallucination risks cannot
be completely eliminated.

## Privacy and Data Handling

Sentinel AI performs configured AI inference locally
through Ollama.

Conversation and investigation history saving are
disabled by default.

When persistence is enabled, information is stored
in a local SQLite database.

The database is not encrypted.

Temporary operations are designed not to persist
conversation or investigation records in SQLite.

This does not guarantee secure memory erasure,
absence of operating system logs, or removal of
all temporary system data.

Users are responsible for protecting their local
environment and handling sensitive information
appropriately.

## Secure Deployment Recommendations

- Bind application services to localhost.
- Do not expose the application directly to the internet.
- Use a trusted operating system account.
- Keep Python, Node.js, Ollama, and dependencies updated.
- Review dependency security advisories.
- Avoid submitting real credentials or confidential data.
- Use only trusted machine learning model artifacts.
- Protect access to the local database.
- Independently verify AI-generated recommendations.

## Known Security Limitations

Sentinel AI currently does not provide:

- Application-level authentication.
- Application-level authorization.
- Encrypted database storage.
- Multi-tenant isolation.
- Comprehensive rate limiting.
- Guaranteed prompt injection prevention.
- Guaranteed detection of malicious activity.
- Secure deletion of stored records.
- Comprehensive production security auditing.

Host and origin validation are not substitutes
for authentication or authorization.

The application must not be considered an
enterprise-grade security product.

## Machine Learning Model Safety

Sentinel AI uses Joblib to load trained
Isolation Forest model artifacts.

Serialized Python model files can execute code
during deserialization.

Never replace the included model artifacts with
files obtained from untrusted sources.

## Reporting a Vulnerability

If you discover a potential vulnerability:

1. Avoid exploiting the issue against other users.
2. Do not publicly disclose sensitive information.
3. Use GitHub's private vulnerability reporting
   feature if it is enabled for this repository.
4. Include the affected version and component.
5. Provide reproduction steps using synthetic data.
6. Describe the potential security impact.

If private vulnerability reporting is unavailable,
request a private reporting channel without
publishing sensitive vulnerability details.

As this is an independent research project,
response and remediation times are not guaranteed.

## Responsible Disclosure

Security research should be conducted responsibly,
within authorised environments, and in accordance
with applicable laws.

Do not use Sentinel AI to access, investigate,
or interfere with systems without permission.

## Disclaimer

Sentinel AI is provided as a research and
educational software project.

Detection results and AI-generated reports
are advisory and require independent verification.

No security control implemented by Sentinel AI
guarantees protection against all cyber threats.

---

Sentinel AI — Security Policy
