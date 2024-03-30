---
tags:
  - linux
description: File-locking on Linux is not atomic and FIFO, meaning readers and writers can claim locks in any order, running contrary to what the behavior should appear like.
title: File-locking on Linux via `fcntl` is not atomic.
---
file-locking on linux is NOT atomic, contrary to what the docs may tell you.

To demonstrate, consider this toy server and client.

**Server**
```{python}
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

```{python}
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

*This is written in Python, but is a mirror of how the program could be written in C*

In this case, the client initializes a `memfd` and passes it to server process via `unix domain sockets` for IPC purposes. The server then takes a lock on the memfd, does a write on it, then releases the lock and immediately tries to claim it. Since the client claimed the lock before the server re-claimed the lock, it should claim the lock immediately after. 

In practice, it does not work like this. Gotta use something like `eventfd` as mechanism for process-based synchronization (or futexes).