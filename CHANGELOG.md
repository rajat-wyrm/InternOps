# Changelog

All notable changes to InternOps are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- SECURITY.md with vulnerability disclosure policy
- aria-label attributes to icon-only navigation buttons for accessibility
- maxLength constraint on task title input
- Loading state and disabled behaviour on avatar upload button
- Null check before client.release() in dbTx utility

### Changed

- Standardized Hindi comments in RBAC middleware to English
- Removed stale log files from repository root
- Removed leftover TODO comments from uploads repository
- Guarded console.warn in deleteFile behind NODE_ENV check

### Security

- Added security policy document
