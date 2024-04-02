---
tags:
  - notes
---
- work-stealing is an algorithm that enables threads in an application to "steal" work from other threads to balance tasks across threads
	- context: in a multithreaded environment, a thread may be working on a set of tasks, but tasks may take a variable amount of time to finish, leaving the workloads unbalanced. a work-stealing algorithm dynamically balances the workload across a set of threads to balance workloads. 
- we want to avoid doing as much work as possible on the main thread, since we could potentially get bottlenecked if the work required to pass the task onto the worker thread is "expensive" and we need to handle a large amount of tasks
	- similarly, we could have the boss manage the worker's queues, but that's an expensive operation that involves too much synchronization.
	- if a thread isn't doing work, that means it's free to go look for work: we want to keep the main thread as free as possible to coordinate in other ways. 
- while we could spawn a thread per task, threads are expensive to create + delete + consume a fixed amount of memory. so we try to map our unit of work into a fixed amount of threads, which ideally maps 1:1 to kernel threads to avoid thread context switching
	- while not explicitly related to work-stealing, a model that maps M "virtual threads" (which in this case, is a "task" of work) to N kernel threads is considered a M:N scheduler. The "M" threads (or tasks) live in userspace.
	- also called "green threads", but all the semantics are not very well-defined
- IO these days is faster than a thread context switch! due to io_uring and IORing (on Windows) and hardware like NVME. 
- is it safe to pass pieces of work between threads? a task must have ownership of its own data to be safely passed between threads. it can't rely on thread-local storage.
	- there likely is some overhead with passing a task to another thread, but not as much overhead as a thread just chilling doing nothing 
- we want to avoid touching the kernel as much as possible, ie do as much in userspace as possible.
- implementations of "work-stealing"
	- [tokio](https://tokio.rs/blog/2019-10-scheduler)
	- [go](https://rakyll.org/scheduler/)
- alternatives:
	- "share-nothing" or "thread-per-core"
		- relies exclusively on assigning pieces of work to a thread, with the threads not interacting with eachother (or doing so by message passing). can be faster in many scenarios
		- popularized by [seastar](https://seastar.io/)