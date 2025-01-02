---
title: Global (database) dependencies in FastAPI, done right with lifespans
description: Globals are the root of all evil, and Python is more than happy to let you indulge. FastAPI provides an alternative mechanism, but it's not well-known.
tags:
  - observations
---

As much as I love python, it also makes you fight _hard_ to avoid doing the wrong things. The wrong thing in this case being global state.

FastAPI, my favorite python web framework, implicitly encourages the use of globals through its [Dependency](https://fastapi.tiangolo.com/tutorial/dependencies/) system. You define a global, throw it in a getter function defined as a dependency, you declare them in your handlers, and FastAPI will solve the tree for you, ensuring you don't get race conditions. As much as I appreciate the power and the ergonomics, I really don't like this. There's no way to validate the correct behavior until runtime. It also makes it hard to test, usually requiring to manually override the dependency in unit tests.

# The anti-pattern

Imagine you have a global dependency, say, a database engine. Instead of defining it as a global, let's define it as a function:

```python
# this is psuedocode, but based off async sqlalchemy off the top of my head
async def get_engine() -> AsyncGenerator[AsyncEngine]:
    engine = create_async_engine(...)
    try:
        yield engine
    finally:
        await engine.dispose()


async def get_session(
    session: Annotated[AsyncEngine, Depends(get_engine)],
) -> AsyncSession:
    async with AsyncSession(engine) as session:
        yield session
```

Using FastAPI's dependency system, you would use this as follows:

```python
@app.get("/handle")
async def my_handler(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    my_object = {"my": "thing"}
    session.add(my_object)
    session.commit()
    return my_object
```

When this endpoint is hit with a `get` request, FastAPI will solve the dependency tree, finding that `get_session` depends on `get_engine`, then it will call that, provide the value to `get_session`, and then we have a database session. Simple!

This code has a problem. If you were to keep calling this endpoint, FastAPI would spin up a database engine _per_ request. It's best practice to keep an engine for the lifetime of your application, as it handles all the complicated database pooling nonsense. This is simply encouraging poor performance, as Database IO is likely the main blocker for your application.

There's a bunch of ways you can solve this. You can define a global inside your module:

```python
__engine: AsyncEngine | None = (
    None  # I have multiple underscores, pweese do not import me
)


async def get_engine() -> AsyncEngine:
    global __engine
    if __engine is None:
        __engine = create_async_engine()

    return __engine
```

I don't like this, and nor should you. Another way we can solve this is by using the `functools.cache` decorator (or `functools.lru_cache` if you're on an ancient version of python). Just throw it on, and now,

```python
from functools import cache


@cache
async def get_engine() -> AsyncGenerator[AsyncEngine]:
    engine = create_async_engine()
    try:
        yield engine
    finally:
        await engine.dispose()
```

When this engine is created, our application now has one engine. Problem solved!

This is a suboptimal solution. Our application only creates the engine when a handler that requires the dependency is called. Your application could start up, and things _seem_ alright, but it could then crash on a request if you failed to get a connection for some reason. With the engine tied outside the lifecycle of the application, we don't get predictable teardowns, which has all the potential for side-effects.

Our database should live _immediately before_ and immediately _after_ FastAPI, like an outer layer. We initialize it when FastAPI starts up, and when we CTRL-C (aka `SIGTERM`), our database should have the opportunity to clean itself up. It would be convenient if we could tie it to, say, the _lifespan_ of FastAPI...

> [!example]
> Some people attempt to solve this conundrum using [`contextvars`](https://github.com/fastapi/fastapi/discussions/8628). Contextvars scare me and I avoid them wherever possible.

# The right way with ASGI Lifespan

FastAPI features support for aptly-named `ASGI Lifespan` protocol. For example, here's a lifespan modified directly [from FastAPI's docs](https://fastapi.tiangolo.com/advanced/events/#lifespan).

```python
from contextlib import asynccontextmanager

__engine: AsyncEngine = None


async def get_engine() -> AsyncGenerator[AsyncEngine]:
    yield __engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    global __engine
    __engine = create_async_engine()
    yield
    await __engine.dispose()


# when we create our FastAPI app...
app = FastAPI(lifespan=lifespan)
```

Pretty cool! A big improvement on our old code, as we can properly handle clean-ups. But it's still not optimal, as our dependency relies on the global state. Is it possible to make it, _not_?

Nested in the [ASGI spec](https://asgi.readthedocs.io/en/latest/specs/lifespan.html), there's an interesting feature of lifespans: when you `yield`, you can `yield` stuff from it. Instead of the defining a global, you can just,

```python
class AppState(TypedDict):
    engine: AsyncEngine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[AppState]:
    engine = create_async_engine()
    yield {"engine": engine}
    await engine.dispose()
```

And now, our engine is part of our application! To be more specific, it's part of the `ASGI Scope`. You can access it by simply defining our new session dependency like:

```python
from fastapi import Request


async def get_session(request: Request) -> AsyncGenerator[AsyncSession]:
    engine = request.scope["state"]["engine"]
    async with AsyncSession(engine) as session:
        yield session
```

Inside that dependency, we get a new session, initialized with a `shallow copy` of our engine (important for performance), that's tied to the lifespan of our FastAPI app. No dependency solving required, as the engine is associated with every request.

When you ask FastAPI to shut down, FastAPI will clean itself up, and then the lifespan will pass its `yield` point, allowing the engine to `dispose` of itself.

This also means you can introduce additional initialization _before_ your application even starts. For example, let's say you have some custom logic that uses alembic to migrate a database, you can call it as part of your lifespan logic.

```python
class AppState(TypedDict):
    engine: AsyncEngine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[AppState]:
    engine = create_async_engine()
    await run_migrations(engine)
    yield {"engine": engine}
    await engine.dispose()
```

If the migration were to fail (and the function throws), your application wouldn't just start up in the first place. Since your database is a prerequisite to your entire application, this is more correct behavior than simply waiting for it to happen.

ASGI Lifespans are powerful! You should associate stuff with your application rather than letting it live external to it. I throw in pretty much everything inside of it, including my application settings (of which I use `pydantic_settings`), and all my dependencies are just wrappers that pull directly from the ASGI scope. It also has the benefit of being far more testable, as you can just mock the underlying object injected into the lifespan rather than overriding the dependency itself.

The downside of this approach is that you can't use the database outside of FastAPI. But I consider this to be a **feature, not a bug**. In my view, it's an anti-pattern to do things external to your web server without explicit user interaction. If you _really_ need to step out of this, in your lifespan, you can schedule an task on the event loop, but you better have a damn good reason. The lifespan encourages you to think deeply about what the lifecycle of your application is, which I find leads to more predictable and maintainable code.

> [!example]- How to do periodic tasks
> If you wanted to do this, here's a quick example of how this is possible with the `asyncio.TaskGroup` abstraction:
>
> ```python
> import asyncio
>
> async def periodic_task(shutdown_event: asyncio.Event) -> None:
>     timeout = 100
>     while not shutdown_event.is_set():
>         try:
>             await asyncio.wait_for(shutdown_event.wait(), timeout=timeout)
>             break
>         except TimeoutError:
>             ... # your actual periodic task
>
>
> async def lifespan() -> AsyncGenerator[AppState]:
>     shutdown_event = asyncio.Event()
>     async with asyncio.TaskGroup() as tg:
>         tg.create_task(my_periodic_task(shutdown_event))
>         yield
>         shutdown_event.set()
> ```
>
> The upside of this design being that your TaskGroup will now clean itself up when the lifespan exits. You can additionally pass an object from the lifespan into the defined `periodic_task` (like a database engine), meaning we keep the lifespan philosophy intact.

# Appendix: Database dependencies, done right

This design primarily came from an issue that propped up with FastAPI in recent versions. I too, previously did something like:

```python
async def get_session(...) -> AsyncGenerator[AsyncSession]:
	async with AsyncSession(engine) as session:
		try:
			yield session
		except:
			session.rollback()
		finally:
			session.commit()
```

The goal being that if I had an unhandled exception inside of a handler, the database would automatically roll itself back. This unfortunately [stopped working](https://github.com/fastapi/fastapi/issues/11143) due to some internal changes inside FastAPI's dependency resolution system.

Instead, we can solve this problem by using middleware.

> [!info]
> I took all the code below and put it in a library: [`asgi-sqlalchemy`](https://pypi.org/project/asgi-sqlalchemy/).

First, we define a database abstraction as follows, that implements the Async Context Manager protocol.

```python
# imports and type hints excluded for brevity
class DatabaseContext(AbstractAsyncContextManager):
	"""Async context manager representing the lifespan of a database."""
	def __init__(self, url: str, engine_kwargs = None, session_kwargs = None):
		""""Initialize the database with an engine and session maker."""
		self._engine = create_async_engine(url, **engine_kwargs if engine_kwargs is not None else {})
		self._session_maker = async_sessionmaker(
			self._engine, **session_kwargs if session_kwargs is not None else {}
		)

	async def __aenter__(self) -> Self:
		return self

	async def __aexit__(self, exc_type, exc_value, traceback) -> None:
		await self.dispose()

	@property
	def engine(self) -> AsyncEngine:
		"""Get a handle on the `AsyncEngine`."""
		return self._engine

	@property
	def session_maker(self) -> async_sessionmaker[AsyncSession]:
		"""Get the internal `async_sessionmaker`."""
		return self._session_maker

	async def dispose(self) -> None:
	"""Dispose of the engine."""
		await self._engine.dispose()
```

Now, we can use `async with DatabaseContext(...) as db` inside of our lifespan function, and we've abstracted the lifespan of the database itself, so we no longer need to manually dispose.

```python
@asynccontextmanager
async lifespan(app: FastAPI) -> AsyncGenerator[AppState]:
	async with DatabaseContext(...) as db:
		yield { "db": db }
```

We can define some middleware that reads the db injected into the ASGI scope, creates a session based off of it, then adds it to the request-specific `scope`.

```python
class SessionMiddleware:
    """Pure ASGI middleware that injects a database session into the `scope`."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        db = scope["state"].get("db")
        if scope["type"] != "http" or db is None:
            await self.app(scope, receive, send)
            return
        async with db.session_maker() as session:
            scope["db_session"] = session
            try:
                await self.app(scope, receive, send)
            except Exception:
                await session.rollback()
                raise
            await session.commit()
```

`scope.state` is global to every scope, while `scope["key"]` is specific to the the given request. A bit confusing, but don't worry about it.

We finally have to define the dependency:

```python
async with get_session(request: Request) -> AsyncSession:
	return request.scope.get("db_session")
```

And we can use it in any handler we desire!

```python
app.get("/my_handler")
async def my_handler(session: Annotated[AsyncSession, Depends(get_session)]):
	# do some stuff with your session
```

The main power of this approach is that you can automatically rollback the database on an unhandled exception. However, if manually triggering a `HTTPException`, a rollback won't occur unless manually initiated, which is often desired behavior. Take a look at the tests [here](https://github.com/abhiaagarwal/asgi-sqlalchemy/blob/2bf72c46bd2798d7ffe5fd29b21bf50be16a4ec5/tests/test_fastapi.py).
