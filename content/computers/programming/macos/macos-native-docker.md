---
tags:
  - docker
  - macos
  - virtualization
title: How to run docker on MacOS with close-to-native performance
---
I wanted to run docker containers fast + close to native performance for working with linux projects without dealing with the hassle of figuring out the equivalent dependencies on macos.

```sh
brew install colima
colima start --arch arch64 --vm-type=vz --vz-rosetta --mount-type=virtiofs
```

Colima is a docker runtime (or Lima, blah blah).

This command uses `vz`, which is Apple's Native Hypervisor, +Rosetta, +Virtiofs to create a small VM (Ubuntu I believe) with a default size of 60GB to store docker images.

You can also run x86 images on this, and through Rosetta, it will have close to native performance.