---
tags:
  - observations
title: Running a bunch of python futures in a safely
---
Hey, did you know that unless you know exactly what you're doing, you should _never_ use `asyncio.gather` after manually creating async tasks via `asyncio.create_task()`? 

This code,

```python
async def my_function(val: int) -> int:
    return val * 2

async def main() -> None:
    task_1 = asyncio.create_task(my_function(1))
    task_2 = asyncio.create_task(my_function(2))
    task_3 = asyncio.create_task(my_function(3))

    results = await asyncio.gather(*tasks)
    print(results) # expect [2, 4, 6]


if __name__ == "__main__":
    asyncio.run(main())
```

is actually _deeply_ unsafe. Let me cite the (in)famous article that alerted me to this problem, [the heisenberg lurking in your async code](https://textual.textualize.io/blog/2023/02/11/the-heisenbug-lurking-in-your-async-code/). Here's also an excellent [stack overflow](https://stackoverflow.com/a/76823668/21551208) answer that goes a bit more in depth. In short, due to python's garbage collector, those `task_*` objects we created are weak references. Python's garbage collector doesn't understand that those `task_*` objects have a life after the `asyncio.gather`, and they may just be arbitrarily garbage collected by python, and never run.

Why does python do this?  ¯\\\_(ツ)\_/¯. I would like to have a cordial conversation to whoever designed it this way. 

In fact, the [asyncio docs for `create_task`](https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task) have a warning for this:

![[running-a-bunch-of-futures-asyncio-docs.png]]Alright, fair, but I, like hundreds of millions developers, will skip text that's in a grey box. It needs to have red scary text, maybe outlined in red, and it should also have a popup in the browser. Guido Van Rossum should mail each IP address that has ever downloaded python a hand-written letter warning them of this. That's how serious this problem is.

The alternative solution, as the docs mention, is to use `asyncio.TaskGroup`. I actually _love_ the `asyncio.TaskGroup()` abstraction, and it serves its purpose well.

```python
async def my_function(val: int) -> int:
    return val * 2

async def main() -> None:
    async with asyncio.TaskGroup() as tg:
        task_1 = tg.create_task(my_function(1))
        task_2 = tg.create_task(my_function(2))
        task_3 = tg.create_task(my_function(3))

    results = [task_1.result(), task_2.result(), task_3.result()]
    print(results) # expect [2, 4, 6]


if __name__ == "__main__":
    asyncio.run(main())
```

Pretty good! After the `tg` scope context manager has ended, we are guaranteed that each task has finished (or errored). Even though I have strong feelings about python not really having true scoping, we are able to consume the results of those tasks. But it still is a bit un-ergonomic. What if we want to create 1 million tasks, all with the same function, and get the results of all of them simultaneously? 

```python
async def my_function(val: int) -> int:
    return val * 2

async def run_a_bunch_of_tasks(n: int) -> list[int]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(my_function(i)) for i in range(n)]
    return [task.result() for task in tasks]

async def main() -> None:
    results = await run_a_bunch_of_tasks(1000000)
    print(results) # expect [2, 4, 6, ..., 1999998, 2000000]


if __name__ == "__main__":
    asyncio.run(main())
```

Nicer, but now let's _really_ abstract it.

```python
import asyncio
from collections.abc import Awaitable, Iterable
from typing import TypeVar

T = TypeVar("T")


async def run_futures(coros: Iterable[Awaitable[T]]) -> list[T]:
    async with asyncio.TaskGroup() as tg:
        tasks: list[asyncio.Task] = [tg.create_task(coro) for coro in coros]
    return [t.result() for t in tasks]
```

Now, we can use it.