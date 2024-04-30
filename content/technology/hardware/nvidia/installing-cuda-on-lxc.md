---
title: Installing CUDA/Nvidia Drivers on a host to be shared with Linux Container(s)
tags:
  - observations
---
I have a 4090 GPU. I want to share the GPU across multiple lightweight Linux Containers (LXCs), of which they might share them with Docker containers, which could theoretically share... whatever, you get it. I want access to `nvcc` on LXCs for development.

This is a little bit more of a convoluted process than it may seem like. It involves messing with the kernel, building kernel modules, downloading multiple packages, but in the end, you get a GPU that can be used in multiple contexts avoiding the overhead of virtualization, with all the upside of containerization and isolation.

I'm doing this on a fresh installation of proxmox. My server is using a 7950x3D + a RTX 4090 PNY. Yes, overkill, it's a dual gaming/workstation/ML server that's rack-mounted. 