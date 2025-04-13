---
title: The only python interview question you will ever need
tags:
  - thoughts
---

I've been thinking recently about Python API design (as one does, in their mid 20s). I'm someone who cares deeply writing performant code, so I often turn to [[threading|threading, multiprocessing]] or asyncio when dealing with IO-bound work (which is the majority of python applications).

I was looking at the API design for `concurrent.futures.ProcessPoolExecutor/ThreadPoolExecutor.submit()`, which looks something like:

```python
def cpu_bound_function(val, *, keyword_arg):
    ...

# or ThreadPoolExecutor()
with ProcessPoolExecutor() as executor:
    task = executor.submit(cpu_bound_function, 5, keyword_arg=10)
```

And `asyncio.TaskGroup.create_task()`, which looks something like:

```python
async def io_bound_function(val, *, keyword_arg):
    ...

async with TaskGroup() as tg:
    task = tg.create_task(io_bound_function(5, keyword_arg=10))
```

The question is: **Why are these APIs different?** Or, **why can't `ProcessPoolExecutor/ThreadPoolExecutor` use the nicer, ergonomic API of `asyncio.TaskGroup.create_task()`**?

I like the question because if you understand how async code works (not even necessarily in python, this same logic applies to Javascript promises or Rust Futures) then it's immediately obvious. Additionally, if you have a minimum understanding of threading/multiprocessing as a concept, it's obvious.

If it isn't obvious to you: time to study :)

# Appendix: What LLMs say

This isn't a particularly esoteric question or anything, but I wanted to see what LLMs think about it. The prompt was exactly the text above, with the first and last paragraphs excluded. Here's what a few of them say.

> [!example]- [[claude-sonnet-3.5|Claude Sonnet 3.5]]
>
> This is a great question about API design! Let me break down why these APIs are different and why the ProcessPoolExecutor/ThreadPoolExecutor can't use the same approach as TaskGroup.
> The key difference lies in how these executors handle function execution:
>
> 1. **TaskGroup (asyncio)** operates within the same process and thread. When you write:
>
> ```python
> tg.create_task(io_bound_function(5, keyword_arg=10))
> ```
>
> The function call `io_bound_function(5, keyword_arg=10)` is evaluated in the current process, creating a coroutine object. This coroutine object is then scheduled for execution by the event loop.
>
> 2. **ProcessPoolExecutor/ThreadPoolExecutor** needs to execute the function in a different process/thread. If they used the same API:
>
> ```python
> # If this was possible (but it's not):
> executor.submit(cpu_bound_function(5, keyword_arg=10))
> ```
>
> The function call would be evaluated in the current process before being submitted to the executor. This would mean:
>
> - For ProcessPoolExecutor: The function would actually run in the main process, defeating the purpose of process pooling
> - Arguments would be evaluated in the wrong process/thread
> - The function and arguments would need to be pickled/serialized after execution rather than before
>
> Instead, by using:
>
> ```python
> executor.submit(cpu_bound_function, 5, keyword_arg=10)
> ```
>
> The executor can:
>
> 1. Pickle/serialize the function reference and arguments separately
> 2. Send them to the worker process/thread
> 3. Only then evaluate the function call in the correct process/thread
>
> So while the TaskGroup API is more ergonomic, the ProcessPoolExecutor/ThreadPoolExecutor API is designed this way out of necessity - it needs to delay the function call evaluation until it reaches the worker process/thread. The distinction becomes even clearer with something like:
>
> ```python
> # With TaskGroup - evaluates get_expensive_value() immediately
> tg.create_task(cpu_bound_function(get_expensive_value(), keyword_arg=10))
>
> # With ProcessPoolExecutor - only passes the function reference
> executor.submit(cpu_bound_function, get_expensive_value(), keyword_arg=10)
> ```
>
> The second case evaluates `get_expensive_value()` in the main process before submission, which might not be what you want if it's a CPU-intensive operation.
>
> > [!info] Verdict
> > Like most things, Claude gives a great, concise answer. I especially like the example.

> [!example]- ChatGPT o1
> A convenient way to think about it is that **the `asyncio` world and the `concurrent.futures` world solve “concurrency” in very different ways**, with very different constraints. They _look_ somewhat similar (both submit “tasks” that run concurrently), but under the hood they’re operating in different paradigms:
>
> 1. **`asyncio` uses an event loop and coroutines**
>
>    - `create_task(coro)` receives a _coroutine object_, which is a first-class object in Python.
>    - That coroutine object is then scheduled to run on the event loop.
>    - When you write `tg.create_task(myfunc(5, x=10))`, you are _already calling_ `myfunc(...)` in order to _build the coroutine object_, but you are _not_ actually running the function’s body yet (because coroutines don’t run until the event loop schedules them).
>
> 2. **`concurrent.futures` (ProcessPoolExecutor/ThreadPoolExecutor) uses callable + arguments**
>
>    - `executor.submit(func, *args, **kwargs)` sends the callable _plus_ the arguments into a worker thread or process.
>    - In the case of a `ProcessPoolExecutor`, `func` and its arguments must be _pickleable_.
>    - The actual function call happens in a completely separate thread or process, so it needs your function object and arguments in a form that can be passed across processes.
>    - If you wrote something like `executor.submit(myfunc(5, x=10))`, that would _immediately call_ `myfunc(5, x=10)` in the current process—returning its result (or a coroutine object, if `myfunc` was async)—and then try to submit that _value_ (rather than the function) to the executor. That’s not what we want.
>
> ---
>
> ## Why they can’t just share the same API
>
> 1. **Different concurrency models**  
>    `asyncio` is _single-threaded_ concurrency driven by an event loop (cooperative multitasking), whereas `concurrent.futures` is about _multi_-threading or multi-_processing_ concurrency (preemptive multitasking). They each require different underlying mechanisms.
> 2. **Pickle vs. coroutine objects**
>
>    - With `ProcessPoolExecutor`, any function you submit must be importable at the top level and must be pickleable.
>    - A _coroutine object_ (as in `create_task(coro)`) _isn’t_ pickleable in a meaningful way for shipping off to another process.
>    - Even in a thread pool, the executor expects a function pointer plus arguments; it doesn’t integrate with an event loop or coroutines directly.
>
> 3. **Historical reasons / different eras**
>
>    - `concurrent.futures` predates `asyncio` and was heavily influenced by Java’s executor pattern (where you submit a callable and arguments).
>    - `asyncio` came later with a different design: coroutines, an event loop, `await`, etc.
>    - By the time `asyncio` matured, `concurrent.futures` already had its established `submit(func, *args, **kwargs)` pattern, so there wasn’t a simple or backward-compatible way to unify them.
>
> 4. **They solve different primary use cases**
>
>    - `ThreadPoolExecutor` / `ProcessPoolExecutor`: CPU-bound or blocking tasks, run in separate threads/processes.
>    - `asyncio`: IO-bound tasks that _cooperatively_ yield.
>    - It’s not just syntax sugar—`asyncio` is built around the concept that a function returns immediately as a “cold” coroutine object. In `concurrent.futures`, you must supply a “plain old Python function” that hasn’t been invoked yet (because it will be invoked _in another thread or process_).
>
> ---
>
> ### Putting it all together
>
> When you do:
>
> ```python
> # asyncio
> async with TaskGroup() as tg:
>     task = tg.create_task(myasyncfunc(5, keyword_arg=10))
> ```
>
> - You are constructing a coroutine object `myasyncfunc(5, keyword_arg=10)` in the current thread, and telling the event loop: “Whenever you get a chance, run this coroutine.”
>
> But when you do:
>
> ```python
> # concurrent.futures
> with ProcessPoolExecutor() as executor:
>     fut = executor.submit(myfunc, 5, keyword_arg=10)
> ```
>
> - You are handing _callable plus arguments_ to the executor, which will ship them to a pool worker process. The worker process will then call `myfunc(5, keyword_arg=10)` over there.
>
> If the `concurrent.futures` executors tried to accept the same style—e.g., `executor.submit(myfunc(5, x=10))`—they’d be forced to evaluate `myfunc(...)` _right now_ in your current process. That _defeats the purpose_, because the result of `myfunc(...)` would be computed before even hitting the executor, and there’d be nothing left to run on another thread/process.
>
> Hence the short answer:
>
> > **They have different concurrency models and different technical constraints, so they necessarily end up with different-looking APIs.**
>
> > [!info] Verdict
> > A bit wordy, but overall, the right answer. o1 in general is a bit wordy (not sure if this is intentional behavior), but it could be cut in half and still be right.

> [!example]- Gemini 1206 Exp
> You've hit upon a subtle but important distinction between synchronous and asynchronous programming models, and how that impacts API design. Here's a breakdown of why `concurrent.futures` and `asyncio` differ in their task submission approaches:
>
> **1. Synchronous vs. Asynchronous Execution**
>
> - **`concurrent.futures` (ProcessPoolExecutor/ThreadPoolExecutor):** Designed for **synchronous** code. When you `submit()` a task, the calling thread _blocks_ (waits) or continues execution (depending on further interactions with the future object), but conceptually, it expects the task to run independently, either in a separate thread or process.
> - **`asyncio` (TaskGroup):** Designed for **asynchronous** code using coroutines (`async` and `await`). `create_task()` schedules a coroutine to run concurrently within the event loop. The execution flow doesn't inherently block; it relies on the event loop to manage the switching between coroutines.
>
> **2. Function Call vs. Coroutine Object**
>
> - **`submit()`:** Takes a **callable** (function or method) and its arguments. The executor is responsible for invoking this callable in a separate thread/process. The function is executed directly.
> - **`create_task()`:** Takes a **coroutine object**. The `io_bound_function(5, keyword_arg=10)` in your example _doesn't actually execute the function_. Instead, it returns a coroutine object that represents the suspended execution of that function. The event loop is then responsible for resuming this coroutine at the appropriate times.
>
> **3. The Fundamental Difference**
>
> The core reason for the API difference comes down to this:
>
> - **Synchronous executors need to _call_ your function to make it run.** Therefore, they need the function and arguments separately.
> - **Asynchronous frameworks need to _schedule_ your coroutine within an event loop.** They work with the coroutine object itself, not by directly calling the underlying function. The function has already been called to produce the coroutine object.
>
> **Why Can't `concurrent.futures` Adopt `asyncio`'s Style?**
>
> If `ProcessPoolExecutor/ThreadPoolExecutor` were to accept a coroutine object, they would have no built-in mechanism to execute it. They don't have an event loop. They expect a regular, callable function that they can invoke directly.
>
> **Analogy**
>
> Think of it like this:
>
> - **`concurrent.futures`:** You hand a chef (executor) a recipe (function) and ingredients (arguments) and say, "Make this dish." The chef follows the recipe step-by-step in their own kitchen (thread/process).
> - **`asyncio`:** You hand a head chef (event loop) a set of instructions for a dish (coroutine object). The head chef doesn't cook it immediately but adds it to their list of tasks. They then delegate different parts of preparing the dish (resuming the coroutine) to sous chefs (other parts of the program) as they become available, all while managing other dishes concurrently.
>
> **In Summary**
>
> The difference in API design reflects the underlying models:
>
> - `concurrent.futures`: Call a function to execute it.
> - `asyncio`: Schedule a coroutine object for execution within an event loop.
>
> The API for synchronous execution needs the function and arguments separately because it will invoke the function directly. The asynchronous API uses the coroutine object because it's not responsible for direct execution but rather scheduling within a larger system (the event loop).
>
> > [!info] Verdict
> > I really like this Gemini's tone, and the example is pretty good too.

Verdict: the LLMs know, and they all give what I would classify as _great_ answers.
