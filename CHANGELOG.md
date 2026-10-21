# Changelog

All notable changes will be documented here. Uses SemVer + Conventional Commits.

## [0.2.0](https://github.com/onblank/ob-pulse/compare/v0.1.0...v0.2.0) (2026-10-21)


### Features

* **desktop:** add compact pulse gadget ([#1](https://github.com/onblank/ob-pulse/issues/1)) ([706d231](https://github.com/onblank/ob-pulse/commit/706d2318abff3c885499c4a222955c697a185de4))
* **desktop:** add compact pulse gadget ([#1](https://github.com/onblank/ob-pulse/issues/1)) ([#2](https://github.com/onblank/ob-pulse/issues/2)) ([80f4581](https://github.com/onblank/ob-pulse/commit/80f4581e4eff06b26c19626dc936585c5449df8d))
* **instrumentation:** add bounded request history ([#11](https://github.com/onblank/ob-pulse/issues/11)) ([c5d72f8](https://github.com/onblank/ob-pulse/commit/c5d72f826a65812537f61983a497acedf36d038c))
* **instrumentation:** add opt-in session telemetry ([#4](https://github.com/onblank/ob-pulse/issues/4)) ([4b5c71f](https://github.com/onblank/ob-pulse/commit/4b5c71f0beb683bb2e307adc62a993ddc11a6cb2))
* **lmstudio:** add explicit local benchmark ([#15](https://github.com/onblank/ob-pulse/issues/15)) ([a695613](https://github.com/onblank/ob-pulse/commit/a695613bf67e8ed0e28590a02dc0f5082eded2f5))
* **lmstudio:** manage model lifecycle via v1 api ([#13](https://github.com/onblank/ob-pulse/issues/13)) ([956c6f0](https://github.com/onblank/ob-pulse/commit/956c6f01b54d827dc7a42d49a54e5be603885398))
* promote bounded request history ([bf7ad01](https://github.com/onblank/ob-pulse/commit/bf7ad01d766f254c4a27c6c2aa728d31d30b0132))
* promote LM Studio benchmark ([288a391](https://github.com/onblank/ob-pulse/commit/288a3916f07be8082441b1beb683ced31dd66303))
* promote LM Studio model management ([6b69a5f](https://github.com/onblank/ob-pulse/commit/6b69a5f0635b814428ecce9f6eb192f536448407))
* **widget:** persist appearance preferences ([#17](https://github.com/onblank/ob-pulse/issues/17)) ([0016fd2](https://github.com/onblank/ob-pulse/commit/0016fd2922fe9ef0b4b2e2ef75d98f4cd19f4525))


### Bug Fixes

* **ci:** ignore generated changelog formatting ([#9](https://github.com/onblank/ob-pulse/issues/9)) ([a814d18](https://github.com/onblank/ob-pulse/commit/a814d182310c0c796d06d08a7118bd232196838e))
* **widget:** sync tray settings mode ([#19](https://github.com/onblank/ob-pulse/issues/19)) ([9164702](https://github.com/onblank/ob-pulse/commit/9164702bd44a0de98b9d07232554072b5f2827c2))

## 0.1.0 — Initial scaffold (2026-10-14)

- Proposed OB-Pulse product identity, repo, brand placeholders and Apache-2.0 policy.
- Clean Architecture monorepo, Ollama management and read-only LM Studio detection.
- Compact Electron tray widget; host utilization and benchmark telemetry.
- Domain tests, scoped agent instructions, docs, CI and native packaging templates.

**Limitations:** No verified native installers; dependencies not installed in generation environment,
no passive client instrumentation, no persistent history, no process-specific GPU telemetry.
