---
title: Installing CUDA/Nvidia Drivers on a host to be shared with Linux Container(s)
tags:
  - observations
---

I have a Proxmox server with an RTX 4090. I want to share the GPU across multiple lightweight Linux Containers (LXCs), of which they might share them with Docker containers, which could theoretically share... whatever, you get it. I want access to `nvcc` on LXCs for development. I also want access to the drivers so applications that use hardware acceleration (such as [Jellyfin](https://github.com/jellyfin/jellyfin)) can... accelerate.

This is a little bit more of a convoluted process than it may seem like. It involves messing with the kernel, building kernel modules, passing through drivers, and downloading multiple packages, but in the end, you get a GPU that can be used in multiple contexts avoiding the overhead of virtualization, with all the upside of containerization and isolation.

> [!info]
> If you can avoid it, don't install CUDA on your host or LXCs. You should use devcontainer ecosystem and develop inside a docker container, pulling [`nvidia/cuda-devel`](https://hub.docker.com/r/nvidia/cuda/) for `nvcc` access, and you _should_ do this to pin your dependencies. However, you _will_ need to have the corresponding drivers installed on the host and any additional layers of isolation. This guide includes the installation of drivers, you can skip the CUDA stuff if it's not relevant.

I'm doing this on a fresh installation of Proxmox. My server is using a 7950x3D + a PNY RTX 4090 (my beloved). I will be using debian (btw) as my LXC guest since it's the gold standard, but all of this can be adapted to your relevant distro.

# Getting the relevant driver

Here's a fun fact: NVIDIA releases CUDA releases separately from their gaming/workload drivers, but the latter drivers may sometimes be ahead of their CUDA-based drivers. This can lead to some _fun_ (author's note: horrible) scenarios. NVIDIA does not directly publish what version of the driver is associated with a CUDA release, you need to figure it out yourself. _woohoo!_

God, NVIDIA, I might be your only defender left, but can you please make it easier for the rest of us?
