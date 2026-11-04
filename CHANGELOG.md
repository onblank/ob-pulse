# Changelog

All notable changes will be documented here. Uses SemVer + Conventional Commits.

## [0.2.0](https://github.com/onblank/ob-pulse/compare/v0.1.0...v0.2.0) (2026-11-04)


### Features

* add delegated runtime control ([#34](https://github.com/onblank/ob-pulse/issues/34)) ([dd0d519](https://github.com/onblank/ob-pulse/commit/dd0d519e82df74a797373970752b3fbd7d37adc2))
* add llama.cpp observer adapter ([#49](https://github.com/onblank/ob-pulse/issues/49)) ([36dbd87](https://github.com/onblank/ob-pulse/commit/36dbd87f9a632d8a69eee4b39c3569dd32c389b9))
* **desktop:** add compact pulse gadget ([#1](https://github.com/onblank/ob-pulse/issues/1)) ([706d231](https://github.com/onblank/ob-pulse/commit/706d2318abff3c885499c4a222955c697a185de4))
* **desktop:** add compact pulse gadget ([#1](https://github.com/onblank/ob-pulse/issues/1)) ([#2](https://github.com/onblank/ob-pulse/issues/2)) ([80f4581](https://github.com/onblank/ob-pulse/commit/80f4581e4eff06b26c19626dc936585c5449df8d))
* expose runtime capability manifests ([#43](https://github.com/onblank/ob-pulse/issues/43)) ([163fa02](https://github.com/onblank/ob-pulse/commit/163fa02d1bfed9169624cd1336c48e3b4493fc23))
* **instrumentation:** add bounded request history ([#11](https://github.com/onblank/ob-pulse/issues/11)) ([c5d72f8](https://github.com/onblank/ob-pulse/commit/c5d72f826a65812537f61983a497acedf36d038c))
* **instrumentation:** add opt-in session telemetry ([#4](https://github.com/onblank/ob-pulse/issues/4)) ([4b5c71f](https://github.com/onblank/ob-pulse/commit/4b5c71f0beb683bb2e307adc62a993ddc11a6cb2))
* **lmstudio:** add explicit local benchmark ([#15](https://github.com/onblank/ob-pulse/issues/15)) ([a695613](https://github.com/onblank/ob-pulse/commit/a695613bf67e8ed0e28590a02dc0f5082eded2f5))
* **lmstudio:** manage model lifecycle via v1 api ([#13](https://github.com/onblank/ob-pulse/issues/13)) ([956c6f0](https://github.com/onblank/ob-pulse/commit/956c6f01b54d827dc7a42d49a54e5be603885398))
* **metrics:** sample owned runtime process ([#25](https://github.com/onblank/ob-pulse/issues/25)) ([36c627c](https://github.com/onblank/ob-pulse/commit/36c627c28e1c2dc6cc91ef006daae4431b170365))
* **metrics:** support owned process metrics on Windows ([#28](https://github.com/onblank/ob-pulse/issues/28)) ([04d2f2c](https://github.com/onblank/ob-pulse/commit/04d2f2c7faac3a8098373a4d82e3c8237d8cb0df))
* promote bounded request history ([bf7ad01](https://github.com/onblank/ob-pulse/commit/bf7ad01d766f254c4a27c6c2aa728d31d30b0132))
* promote delegated runtime control ([63ad4eb](https://github.com/onblank/ob-pulse/commit/63ad4ebea5289143a93545ee9dd9bb4b26cfeb42))
* promote llama.cpp observer support ([5c72aef](https://github.com/onblank/ob-pulse/commit/5c72aef7a2ee2e90dbbd2e2e09288cd14db57973))
* promote LM Studio benchmark ([288a391](https://github.com/onblank/ob-pulse/commit/288a3916f07be8082441b1beb683ced31dd66303))
* promote LM Studio model management ([6b69a5f](https://github.com/onblank/ob-pulse/commit/6b69a5f0635b814428ecce9f6eb192f536448407))
* promote runtime capability manifests ([242944d](https://github.com/onblank/ob-pulse/commit/242944d60907b73410141648e5b795d4c25fcf05))
* promote safe runtime control release ([99b8200](https://github.com/onblank/ob-pulse/commit/99b8200bab09f66c3e630e762cbbeefa05aaae67))
* promote secure LM Studio authentication ([50ab1a5](https://github.com/onblank/ob-pulse/commit/50ab1a5d1ffad522e30f806ac34882b8a8f20e60))
* release runtime control safely ([#37](https://github.com/onblank/ob-pulse/issues/37)) ([ae2ef1e](https://github.com/onblank/ob-pulse/commit/ae2ef1eecbfcdc8916ec8ae6de12f1061d72db38))
* **runtime:** configure built-in adapters ([#22](https://github.com/onblank/ob-pulse/issues/22)) ([5a622cc](https://github.com/onblank/ob-pulse/commit/5a622cc04142ef0dfe437e3680dcba494f61c401))
* **runtime:** manage LM Studio server lifecycle ([#31](https://github.com/onblank/ob-pulse/issues/31)) ([42ec7fa](https://github.com/onblank/ob-pulse/commit/42ec7fa8b809c767c37734731955a4f01395af24))
* secure LM Studio authentication ([#40](https://github.com/onblank/ob-pulse/issues/40)) ([a0c0390](https://github.com/onblank/ob-pulse/commit/a0c039099090c32b6a3e29fb452acb4a150ec9d0))
* **widget:** persist appearance preferences ([#17](https://github.com/onblank/ob-pulse/issues/17)) ([0016fd2](https://github.com/onblank/ob-pulse/commit/0016fd2922fe9ef0b4b2e2ef75d98f4cd19f4525))


### Bug Fixes

* **ci:** ignore generated changelog formatting ([#9](https://github.com/onblank/ob-pulse/issues/9)) ([a814d18](https://github.com/onblank/ob-pulse/commit/a814d182310c0c796d06d08a7118bd232196838e))
* promote hardened Windows process probe test ([a3fb1a1](https://github.com/onblank/ob-pulse/commit/a3fb1a1dd6f68e198e6627c6613e1c11b61e5a7c))
* **widget:** sync tray settings mode ([#19](https://github.com/onblank/ob-pulse/issues/19)) ([9164702](https://github.com/onblank/ob-pulse/commit/9164702bd44a0de98b9d07232554072b5f2827c2))

## 0.1.0 — Initial scaffold (2026-10-14)

- Proposed OB-Pulse product identity, repo, brand placeholders and Apache-2.0 policy.
- Clean Architecture monorepo, Ollama management and read-only LM Studio detection.
- Compact Electron tray widget; host utilization and benchmark telemetry.
- Domain tests, scoped agent instructions, docs, CI and native packaging templates.

**Limitations:** No verified native installers; dependencies not installed in generation environment,
no passive client instrumentation, no persistent history, no process-specific GPU telemetry.
