# Changelog

## 0.1.0 (2026-08-07)


### Features

* add latencyMs to clock the time that the AI spend responding ([0b6b295](https://github.com/cmglezpdev/openwhispr-proxy/commit/0b6b295e611993dbb46b3573eb44a102a0b2423c))
* **audio:** add audio transcription proxy endpoint ([a322330](https://github.com/cmglezpdev/openwhispr-proxy/commit/a3223301b895052e19eb9ea9f8807dffc9ba622e))
* **chat:** add chat completions proxy endpoint ([86fbaf3](https://github.com/cmglezpdev/openwhispr-proxy/commit/86fbaf348ba57fb59a2eb022c3445581d9d60dc4))
* **chat:** validate model format via shared provider/model validator ([6b5f66a](https://github.com/cmglezpdev/openwhispr-proxy/commit/6b5f66a02dcce3d268907872a127ec751b596dba))
* **models:** add model catalog endpoint ([dc7e037](https://github.com/cmglezpdev/openwhispr-proxy/commit/dc7e0377730d46b094c2d01444b23b8fb0e88dec))
* read config from a typed EnvService instead of process.env ([c9e1b21](https://github.com/cmglezpdev/openwhispr-proxy/commit/c9e1b21a7603666d9d55ff9c4e65f842a88e6f33))
* **usage:** add SQLite-backed usage tracking repository ([6b96743](https://github.com/cmglezpdev/openwhispr-proxy/commit/6b967430f8adbe3f714bae2ecc6702d6c191bfbd))


### Bug Fixes

* **audio:** extract duration from file when the AI response omits it ([#2](https://github.com/cmglezpdev/openwhispr-proxy/issues/2)) ([5aea2b6](https://github.com/cmglezpdev/openwhispr-proxy/commit/5aea2b65695ccc490b1767749c3c586e693d05b2))


### Miscellaneous Chores

* release 0.1.0 ([dc17047](https://github.com/cmglezpdev/openwhispr-proxy/commit/dc170475fb472288aa6479820938c2fd186e216d))
