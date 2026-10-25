# On-device face models

The face-auth runtime uses the five TFLite assets in this directory for face detection, landmarks, embedding generation, and liveness. `manifest.json` contains their SHA-256 digests. The binary assets total about 61 MB; they are bundled into native app builds and inference runs on the device.

Model assets and the face-auth pipeline are sourced from [aashup/face-auth](https://github.com/aashup/face-auth), package version 0.1.0. The upstream model notes declare Apache-2.0 / MIT licensing; see `LICENSE` and the upstream model provenance before redistribution. Review and validate model licensing and performance for the deployment jurisdiction and target devices before production rollout.

The app stores embeddings in the face-auth encrypted local store. Face enrollment and punch verification must use the same device because this project does not provision templates between devices. Camera-derived debug frame dumps are disabled by `scripts/patch-face-auth.js`.
