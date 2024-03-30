---
title: Sending file descriptors through unix domain sockets
tags:
  - observation
---
Unix domain sockets is the third type of socket (after TCP and UDP) which enables IPC. It also has a pretty unique power in that it can duplicate file descriptors across processes.

#  A primer on files in Linux

A "file descriptor" is an abstraction over an object that you can manipulate the data inside of it. It's kinda like a `malloc`'d block of memory, except instead of being tied to the virtual address space of your program, it's tied to the external context of your operating system. Note that I'm using "kinda" very liberally here, for there are an uncountably infinite amount of "ifs" and "buts" attached to this. 

Indeed, you can treat your file descriptor like a block of memory through `mmap`ing with little care if you so feel.

Fun fact: At least on linux, `malloc` uses a `mmap`ed file internally (well it depends, see this [nice article](https://utcc.utoronto.ca/%7Ecks/space/blog/unix/SbrkVersusMmap) for a writeup for how convoluted the whole thing is). So it's really all files all the way down.

Of course, it's a bit more complicated than that. At least on Linux, a file descriptor is an interface to an *open file description*, which is a kernel abstraction. One *descriptor* can point to one *description*, which can point to one file only. Yet one file could theoretically have multiple *descriptions* to it. If two files in two separate processes `open` the same file simultaneously, they will have two independent file *descriptions*, and a *descriptor* that points to that description. Hell, you could even have multiple *descriptions* in a program pointing to the same file (with its each own independent *descriptor*).

A *description* shares the same internal file offset (if one *descriptor* changes the *description*'s offset with `lseek`, a *descriptor* pointing to that same *description* will immediately see it) as well as any flags. You could `open` a file in `O_APPEND` more, and then that same file could then be opened in a different context as `O_NONBLOCK`. 

POSIX as a whole guarantees that `read` and `write` calls [are atomic](https://pubs.opengroup.org/onlinepubs/9699919799.2018edition/functions/V2_chap02.html#tag_15_09_07), meaning that you can never observe the intermediary state between *before the operation* and *after the operation*. This does not necessarily mean that each call will complete, as the various `read`/`write` syscalls return a value indicating how many bytes they were actually able to perform. 

It gets even more complicated when you consider the page cache, as when you perform an operation on a file, it first gets propagated to the page cache, and then to the underlying file. If your file was `open`ed in `O_DIRECT | O_SYNC`, then, uh...

¯\\\_(ツ)\_/¯

Point is that reasoning about files is inherently an unsafe process. You can't (normally) make any real guarantees that if you're manipulating one, that it will continue to exist. Another process could come right in and destroy it. Its lifetime is external to yours, and interfacing with an object whose lifetime you don't own and exists in a constant global, mutable context is a scary, scary prospect. 

# What about MacOS or Windows?

I wish I knew the internals for how this is done on MacOS. I don't have a clue, nor do I know how to find out. Please leave a comment if you do know :) 

Don't tell me how it works on Windows. I don't care nor do I want to know. I'm an Unix guy at heart, once I get DLSS Frame Generation on Linux I'll never touch a Windows machine again willingly. 

# But why?
We may not be able to control the lifetime of the underlying file, but we can control the lifetime of a descriptor that points to it. This is a stronger guarantee than whatever we were dealing with before. If you create a file owned by your program (via the `memfd_create`) call, you now own the entire lifetime of the "file". This also kinda applies to both the POSIX and SysV shared memory segments, though the lifetime of them is a little more murky in that you have to manually destroy them when done. In practice though, if careful, you can achieve similar-ish results. 

Unix Domain Sockets is the killer feature here. Through the use of the `sendmsg` and `recvmsg` syscalls (which the `read` and `write` syscalls are just a nicer abstraction over), we can duplicate the file descriptor through the `SCM_RIGHTS` control message.

Here's our **producer/sender**:

```c
// this can also be allocated dynamically, but must be done with more care
#DEFINE FDS_EXPECTED ...
int fds[FDS_EXPECTED] = {...};

struct msghdr msgh;
struct iovec iov;
union {
	struct cmsghdr cmsgh;
	char control[CMSG_SPACE(sizeof(fds))];
} control_un;
// this union is used to allocate the exact amount of bytes needed to send len(fds) amount of fds.

// we have to send at least one byte of non-control data
char arbitrary_message[1] = {'A'};
iov.iov_base = &arbitrary_message;
iov.iov_len = sizeof(arbitrary_message);

// we don't need to name our message
msgh.msg_name = NULL;
msgh.msg_namelen = 0;

msgh.msg_iov = &iov;
// this is NOT sizeof(iov), but rather the amount of IOVs we want to send (since we could send multiple).
msgh.msg_iovlen = 1;

msgh.msg_control = control_un.control;
// frustratingly, unlike the iovlen, this needs to be the size of our control_un buffer...
msgh.msg_controllen = sizeof(control_un.control);

control_un.cmsgh.cmsg_len = CMSG_LEN(sizeof(fds));
control_un.cmsgh.cmsg_level = SOL_SOCKET;
// SCM_RIGHTS is our control message superpower. There are other types as well.
control_un.cmsgh.cmsg_type = SCM_RIGHTS;
// These two macros give us the address of our sent message to have the data associated with the control message to be written into.
memcpy(CMSG_DATA(CMSG_FIRSTHDR(&msgh)), fds, sizeof(fds));

ssize_t bytes_sent = sendmsg(client_socket, &msgh, 0);
if(bytes_sent == -1) {
	perror("sendmsg");
	// cleanup...
}
```

It's disgusting. I know. It uses a heavily macro-based API to manipulate the various parts of the message we send. 

Moving on to the **consumer/receiver**:

```c
// I pretend this is fixed, but in general, it doesn't have to be.
#DEFINE FDS_EXPECTED ...
int fds[FDS_EXPECTED];

struct msghdr msgh = {0};
struct iovec iov;
union {
	struct cmsghdr cmsgh;
	char control[CMSG_SPACE(sizeof(fds))];
} control_un;

char arbitrary_message[1];
iov.iov_base = &arbitrary_message;
iov.iov_len = sizeof(arbitrary_message);

// all the same nonsense, for the most part
msgh.msg_name = NULL;
msgh.msg_namelen = 0;
msgh.msg_iov = &iov;
msgh.msg_iovlen = 1;
msgh.msg_control = control_un.control;
msgh.msg_controllen = sizeof(control_un.control);

ssize_t bytes_read = recvmsg(client_socket, &msgh, 0);
if (bytes_read == -1) {
	perror("recvmsg");
	// cleanup ...
}

struct cmsghdr *cmsg;
int num_fds = 0;
// we check if the first control message, looping until we get a non-null one
for (cmsg = CMSG_FIRSTHDR(&msgh); cmsg != NULL; cmsg = CMSG_NXTHDR(&msgh, cmsg)) {
	if (cmsg->cmsg_level == SOL_SOCKET && cmsg->cmsg_type == SCM_RIGHTS) {
		fds = (int *)CMSG_DATA(cmsg);
		break;
	} else {
		// received wrong kind of control message
	}
}

// validate everything else, etc.
```

Note that the integer associated with the file description across each process can be different (and honestly, unless you're extraordinary lucky, it should), but it will point to the same description. You can verify this through manipulating the file offset with `lseek`s and observing it on another process, or by using the [`kcmp`](https://man7.org/linux/man-pages/man2/kcmp.2.html) syscall. The kernel maintains a mapping of file descriptor -> file description.

You now need to find a method of synchronizing the two descriptors. Note that `fcntl` locks will NOT work as you expect for synchronization (see [[fcntl-atomic-locks]]), so you need a different mechanism. Futexes like semaphores and mutexes work, but you need to have a different mechanism to send them to a separate process, or mmap the underlying data inside the descriptor to point it to the futex and then have the consumer take mutual ownership of it.

I prefer using `eventfd` though, since you can send it with the descriptor via UDS sockets. It does involve the use of `read`/`write` syscalls since it isn't in the user-space, but life is all about tradeoffs. Also can do `epoll` nonsense if you're into that like me.

View the [manpages](https://man7.org/linux/man-pages/man7/unix.7.html) for more reference about unix domain sockets and control messages in general.