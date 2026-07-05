# SSO and SCIM Readiness Plan

Issue: #1256

This document defines the enterprise identity readiness target for VoiceLog.
It is a planning contract, not a runtime implementation. The current product
continues to use the existing local and Google auth flows until follow-up
implementation issues are scheduled.

## Current Auth Model

Current server entry points:

- `POST /auth/register` creates a local email/password account and either joins
  an existing workspace by code or creates a workspace owner.
- `POST /auth/login` authenticates local credentials and creates a
  workspace-scoped session.
- `POST /auth/google` verifies a Google ID token, upserts a Google-backed user,
  and creates a workspace owner for new Google users.
- `GET /auth/session` validates the bearer session token and checks workspace
  access before returning the session payload.

Current persisted identity shape:

- `users.provider` distinguishes local and Google-backed users.
- `users.google_sub` and `users.google_email` are the only external identity
  identifiers currently modeled.
- `workspace_members.member_role` is the workspace authorization source.
- `sessions` stores bearer sessions scoped to `user_id` and `workspace_id`.

Current gaps:

- There is no organization or tenant-level identity provider model.
- There is no OIDC/SAML metadata storage or signing certificate rotation path.
- There is no SCIM endpoint for user or group lifecycle management.
- Workspace membership is not yet mapped from external IdP groups.
- Deprovisioning is manual; sessions are not revoked by an external lifecycle
  event.
- Google sign-in is consumer-style ID token login, not Google Workspace
  enterprise SSO with enforced hosted domain, group mapping, or IdP policy.

## Target SSO Options

Recommended provider order:

1. Microsoft Entra ID with OIDC.
2. Google Workspace with OIDC.
3. Generic OIDC for enterprise customers that can supply issuer metadata.
4. SAML 2.0 only when a customer cannot support OIDC.

OIDC should be the default because it aligns with token validation, issuer
metadata discovery, JWKS rotation, and modern enterprise admin tooling. SAML
should be isolated behind provider-specific code and treated as a separate
implementation path.

Required SSO capabilities:

- Per-workspace or per-organization IdP configuration.
- Enforced issuer, audience/client ID, redirect URI, and allowed domains.
- External subject ID mapped to one VoiceLog user.
- Email normalization rules that prevent account takeover when an email changes.
- Optional just-in-time user creation for approved domains.
- Session creation that records `auth_provider`, `auth_method`, and identity
  assurance metadata.
- Audit events for SSO login success/failure, IdP config changes, and session
  revocation.

## Target SCIM Lifecycle

SCIM is the lifecycle authority for enterprise-managed users. The target should
support:

- `GET /scim/v2/ServiceProviderConfig`
- `GET /scim/v2/ResourceTypes`
- `GET /scim/v2/Schemas`
- `GET/POST /scim/v2/Users`
- `GET/PATCH/PUT/DELETE /scim/v2/Users/:id`
- `GET/POST /scim/v2/Groups`
- `GET/PATCH/PUT/DELETE /scim/v2/Groups/:id`

Lifecycle rules:

- Provisioned users start disabled until attached to an allowed workspace or
  group mapping.
- Deprovisioning must revoke active sessions and block future login.
- Group membership maps to workspace membership and role assignment.
- Role mapping must use the RBAC roles documented in
  `docs/enterprise-rbac.md`.
- SCIM deletes should be soft deactivation by default, not destructive data
  deletion.

## Required Schema Changes

Add identity provider configuration:

- `identity_providers`
  - `id`
  - `workspace_id` or future `organization_id`
  - `type`: `oidc`, `google_workspace`, `microsoft_entra`, `saml`
  - `display_name`
  - `issuer`
  - `client_id`
  - encrypted `client_secret_ref` or secret-manager reference
  - `allowed_domains_json`
  - `jwks_uri`
  - `metadata_url`
  - `saml_entity_id`
  - `saml_sso_url`
  - `saml_certificate_fingerprint`
  - `enabled`
  - `created_at`, `updated_at`, `created_by`

Add external identity links:

- `user_identities`
  - `id`
  - `user_id`
  - `identity_provider_id`
  - `external_subject`
  - `external_email`
  - `external_username`
  - `last_login_at`
  - unique `identity_provider_id + external_subject`

Add lifecycle state:

- Extend `users` or add `user_lifecycle_state`
  - `status`: `active`, `disabled`, `deprovisioned`
  - `source`: `local`, `google`, `sso`, `scim`
  - `deprovisioned_at`
  - `deprovisioned_by`

Add SCIM groups and mappings:

- `scim_groups`
  - `id`
  - `identity_provider_id`
  - `external_group_id`
  - `display_name`
  - `raw_profile_json`

- `workspace_group_role_mappings`
  - `workspace_id`
  - `identity_provider_id`
  - `external_group_id`
  - `member_role`
  - `priority`

Add session audit metadata:

- Extend `sessions` with optional `auth_provider`, `auth_method`,
  `identity_provider_id`, and `identity_subject`.

## Required Configuration

Do not add real secrets to `.env.example`. When implementation starts, add
placeholder-only configuration for:

- `VOICELOG_SSO_ENABLED=false`
- `VOICELOG_SSO_DEFAULT_PROVIDER=none`
- `VOICELOG_SCIM_ENABLED=false`
- `VOICELOG_SCIM_TOKEN_SECRET_REF`
- `VOICELOG_OIDC_REDIRECT_BASE_URL`
- `VOICELOG_SAML_ACS_BASE_URL`
- `VOICELOG_IDP_SECRET_ENCRYPTION_KEY_REF`

Provider-specific secrets should live in Railway/Vercel/Supabase secret stores
or a dedicated secret manager. Runtime logs must only report provider IDs and
configuration presence, never client secrets, SCIM bearer tokens, assertions,
SAML responses, or raw IdP tokens.

## Security Risks

| Risk                                 | Required control                                                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Account takeover through email reuse | Link by external subject and provider, not email alone.                                      |
| IdP misconfiguration                 | Require issuer, audience, redirect URI, and allowed domain validation.                       |
| Stale sessions after deprovisioning  | Revoke sessions when SCIM disables or deprovisions a user.                                   |
| Overbroad group role mapping         | Use explicit workspace mapping with deterministic priority and audit logs.                   |
| Secret leakage                       | Store secrets outside the repo and redact auth payloads in logs/Sentry.                      |
| SAML replay or unsigned assertions   | Require signed assertions, audience checks, clock skew limits, and nonce/request validation. |
| JIT user sprawl                      | Gate JIT provisioning by verified domain and workspace allowlist.                            |

## Migration Path

Phase 0 - readiness only:

- Keep existing local and Google login unchanged.
- Publish this plan and use it as the acceptance contract for follow-up work.

Phase 1 - OIDC foundation:

- Add `identity_providers` and `user_identities` migrations.
- Add OIDC callback routes behind `VOICELOG_SSO_ENABLED=false`.
- Add tests for issuer, audience, domain, external subject, and session payload.

Phase 2 - workspace role mapping:

- Add group-to-workspace role mapping.
- Add audit events for membership creation, role change, and deprovisioning.
- Add admin UI read-only status for configured IdP and mapped groups.

Phase 3 - SCIM:

- Add SCIM bearer-token authentication independent of normal user sessions.
- Add user/group endpoints with idempotent PATCH handling.
- Revoke sessions on disable/deprovision.
- Add contract tests for Entra ID and Google Workspace SCIM payload shapes.

Phase 4 - SAML if required:

- Add SAML implementation only after OIDC is stable.
- Keep SAML metadata, certificates, and assertion validation isolated from OIDC
  code paths.

## Follow-up Implementation Issues

Suggested issues:

- Add `identity_providers` and `user_identities` schema migrations.
- Implement OIDC SSO callback behind a disabled-by-default feature flag.
- Add group-to-workspace role mapping and audit events.
- Implement SCIM user lifecycle endpoints with session revocation.
- Add admin read-only IdP status and SCIM provisioning diagnostics.
- Add SAML support only if a customer requirement confirms it.

## Documentation Review Checklist

- [ ] Current auth entry points and tables are represented accurately.
- [ ] The default implementation path is OIDC, with SAML explicitly deferred.
- [ ] Schema changes list provider configuration, external identities, groups,
      mappings, lifecycle status, and session metadata.
- [ ] SCIM deprovisioning includes session revocation.
- [ ] Role mapping references `docs/enterprise-rbac.md`.
- [ ] Config placeholders do not include real secrets.
- [ ] Security risks include email reuse, stale sessions, group mapping, and
      secret leakage.
