# Reliability Review Archive

This historical review filename is retained for inbound links. Retired hostnames, old test
counts and point-in-time diagnostics have been removed.

The active backend is https://eventweaver-api-v2.fly.dev and the active frontend is
https://eventweaver-orpin.vercel.app. The backend uses bounded retries and caching around the
StudioNet rate limit, while the frontend detects stale bundles and reloads after a confirmed
version mismatch.

Current deployment and validation evidence is in
[REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md).
