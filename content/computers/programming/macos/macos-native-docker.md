---
tags:
  - docker
  - macos
  - virtualization
title: Docker on MacOS with close-to-native performance
---
I wanted to run Docker containers fast + close to native performance for working with Linux projects without dealing with the hassle of figuring out the equivalent dependencies on MacOS. This was trivial on Intel-based Macbooks, but is now a pain in the ass with the M-series macbooks.

Here's what I found:

```sh
brew install colima
colima start --arch arch64 --vm-type=vz --vz-rosetta --mount-type=virtiofs
```

Colima is a docker runtime (or Lima, blah blah).

This command uses `vz`, which is Apple's Native Hypervisor, +Rosetta, +Virtiofs to create a small VM (Ubuntu I believe) with a default size of 60GB to store docker images.

You can also run x86 images on this, and through Rosetta, it will have close to native performance.