---
tags:
  - docker
  - observation
title: Docker on MacOS with close-to-native performance
---
I wanted to run Docker containers fast + close to native performance for working with Linux projects without dealing with the hassle of figuring out the equivalent dependencies on MacOS. This was trivial on Intel-based Macbooks, but is now a pain in the ass with the M-series macbooks.

Here's what I found:

```sh
brew install colima
colima start --arch arch64 --vm-type=vz --vz-rosetta --mount-type=virtiofs
docker [whatever]
```

Colima is a docker runtime (or Lima, blah blah). Since Apple doesn't have a native interface to Docker Containers (`cgroups`, I believe, don't quote me on this), Colima provisions a VM for you. This means that there are two layers of indirection to run a docker container. By default, this is very slow. Through some "experimental" technology, we can get some huge speed boosts.

This command uses `vz`, which is Apple's Native Hypervisor. Without specifying `vz`, it will use `qemu`, which is an excellent piece of software — and terrible for usage on ARM-based MacOS.

`vz-rosetta` enables the usage of the Rosetta translation layer inside x86 VMs. Apple has specialized instructions inside their CPUs designed to execute x86 instructions, Hypervisors cannot access them natively (either due to them being undocumented and/or security reasons) without this flag. While the underlying VM will be ARM, you can will be able to run x86 images through Rosetta, it will have close to native performance.

`virtiofs` enables the use of the `virtiofs` driver (which requires `vz`) rather than `sshfs`. If that looks familiar, yes, VMs normally bind-mount data from the host to the guest with `ssh`, and it's on your local machine so it's hypothetically your best case scenario for data transfer latencies, but...

By default, Colima creates an Ubuntu-based VM with a default size of 60GB to store docker images. It also sets the CPU to 2 Cores and Memory to 2G. You can override this with CLI options (go find them yourself, it's not hard) or with `colima start --edit` for changing the default configuration.

Bonus perks: VSCode recognizes the Colima Runtime natively. Not sure if this means anything, but it's cool, I guess.