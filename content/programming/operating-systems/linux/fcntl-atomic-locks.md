---
tags:
  - observations
description: File-locking on Linux is not atomic and FIFO, meaning readers and writers can claim locks in any order, running contrary to what the behavior should be.
title: File-locking is not atomic and FIFO.
---
File-locking on linux is NOT atomic and FIFO, contrary to what the docs may tell you.

To demonstrate, consider this toy server and client.

**Server**
```python
import socket
import os
import fcntl
import struct
import time

ITERATIONS = 100

def server() -> None:
    wr_bytes = struct.pack('hhllhh', fcntl.F_WRLCK, os.SEEK_SET, 0, 0, 0, 0)
    unlock_bytes = struct.pack('hhllhh', fcntl.F_UNLCK, os.SEEK_SET, 0, 0, 0, 0)

    server_socket = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    server_path = "/tmp/test_socket"
    try:
        os.unlink(server_path)
    except OSError:
        if os.path.exists(server_path):
            raise

    server_socket.bind(server_path)
    print("Accepting UDP Connections")
    while True:
        message, fds, _, _ = socket.recv_fds(server_socket, 20, 1)
        message = message.decode()
        print(message)
        fd: int = fds[0]

        n: int = 0
        whoops_count: int = 0
        while n < ITERATIONS:
            fcntl.fcntl(fd, fcntl.F_OFD_SETLKW, wr_bytes)
            file_pos = os.lseek(fd, 0, os.SEEK_CUR)
            if file_pos != 0:
                whoops_count += 1
            else:
                print(f"writing line {n}")
                os.write(fd, str(n).encode())
                n += 1
            fcntl.fcntl(fd, fcntl.F_OFD_SETLKW, unlock_bytes)
        print(f"Ending connection, whoops = {whoops_count}")

if __name__ == "__main__":
    server()
```
**Client**

```python
import socket
import os
import fcntl
import struct
import time
import mmap

ITERATIONS = 100

def client() -> None:
    fd = os.memfd_create("random_bullshit", os.MFD_ALLOW_SEALING)

    lock_type = fcntl.F_OFD_SETLKW

    file_length = 64
    os.ftruncate(fd, file_length)
    os.lseek(fd, 0, os.SEEK_SET)

    fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_GROW |  fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_SEAL)
    wr_bytes = struct.pack('hhllhh', fcntl.F_WRLCK, os.SEEK_SET, 0, 0, 0, 0)
    unlock_bytes = struct.pack('hhllhh', fcntl.F_UNLCK, os.SEEK_SET, 0, 0, 0, 0)

    client = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    client.connect("/tmp/test_socket")
    socket.send_fds(client, [b"CACHEDFILE HELLO"], [fd])

    n: int = 0
    whoops_count: int = 0
    while n < ITERATIONS:
        fcntl.fcntl(fd, fcntl.F_OFD_SETLKW, wr_bytes)
        file_pos = os.lseek(fd, 0, os.SEEK_CUR)
        if file_pos == 0:
            whoops_count += 1
        else:
            os.lseek(fd, 0, os.SEEK_SET)
            data_pr = os.pread(fd, file_pos, 0).decode()
            print(f"{data_pr} (expected {n})")
            n+=1
        fcntl.fcntl(fd, fcntl.F_OFD_SETLKW, unlock_bytes)

    print(f"total whoops {whoops_count}")

if __name__ == "__main__":
    client()
```

*This is written in Python, but is a mirror of how the program could be written in C, and uses the same syscalls.*

In this case, the client initializes a `memfd` and passes it to server process via UDP and unix domain sockets (see: [[sending-fds-through-uds]]). The server then takes a lock on the `memfd`, does a write on it, then releases the lock and immediately tries to claim it. Since the client claimed the lock before the server re-claimed the lock, it should claim the lock immediately after. The client should then read the data inside the `memfd`, and then "flush" the output by setting the cursor, which is shared between the two processes (since both the descriptors share the same *open file description*), to either "0" for the read and "$bytes_written" for the writer. The code explains the logic better than I can.

In practice, this leads to messy race conditions. The order in which they run is completely non-deterministic. I measure this with `whoops_count`. With 100 iterations, I repeatedly got `whoops_count`s of around 400 for both processes, making it totally useless for real-world workloads. That's a 4x "miss" per syscall! 

This also doesn't work with `flock`-based locks, which are completely separate from `fcntl` locks and do not interact with each-other (theoretically). `flock` locks are even more useless, since it isn't possible to upgrade locks atomically (going from a shared lock to an exclusive lock without dropping the lock in the middle). `lockf` uses `fcntl` under the hood, providing a much nicer interface.

The linux source code claims that [while the atomic FIFO behavior isn't required by POSIX, they support it anyways because it makes sense](https://github.com/torvalds/linux/blob/7033999ecd7b8cf9ea59265035a0150961e023ee/fs/locks.c#L782-L795), . A `git blame` reveals this comment was written over 19 years ago, and that's inaccurate in that the commit where that comment comes from is the linux kernel's first commit on git. So that comment could feasibly be 20+ years old.

My guess is that it really was FIFO, once upon a time, and maybe the change to the completely fair scheduler or something underlying caused the behavior to change. Relying on file locking, a syscall, for synchronization is kinda stupid anyways when it should be being done in the userspace for performance reasons.

So, in short, you gotta use something like `eventfd` as mechanism for process-based synchronization (or futexes). I learned this the hard way.