---
title: Global dependencies in FastAPI, done correctly
description: Globals are the root of all evil, and Python is more than happy to let you indulge. FastAPI provides an alternative mechanism, not very well-documented
tags:
  - observations
---
As much as I love python, it also makes you fight *hard* to avoid doing the wrong things. The wrong thing in this case being global state.

FastAPI implicitly encourages the use of globals through its [Dependency](https://fastapi.tiangolo.com/tutorial/dependencies/) system. You define a global, throw it in a getter function defined as a dependency, you declare them in your handlers, and FastAPI will solve the tree for you, ensuring you don't get race conditions. As much as I appreciate the power and the ergonomics, I really don't like this. There's no way to validate the correct behavior until runtime. It also makes it hard to test, usually requiring to manually requiring the dependency at runtime. 
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

async def get_session(session: Annotated[AsyncEngine, Depends(get_engine)]) -> AsyncSession:
	async with AsyncSession(engine) as session:
		yield session
```

Using FastAPI's dependency system, you would use this as follows:

```python
@app.get("/handle")
async def my_handler(session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, str]:
	my_object = { "my": "thing" }
	session.add(my_object)
	session.commit()
	return my_object
```
When this endpoint is hit with a `get` request, FastAPI will solve the dependency tree, finding that `get_session` depends on `get_engine`, then it will call that, provide the value to `get_session`, and then we have a database session. Simple!

This code has a problem. If you were to keep calling this endpoint, FastAPI would spin up a database engine _per_ request. It's best practice to keep an engine for the lifetime of your application, as it handles all the complicated database pooling nonsense. This is simply encouraging poor performance, as Database IO is likely the main blocker for your application.

There's a bunch of ways you can solve this. You can define a global inside your module:

```python
__engine: AsyncEngine | None = None  # I have multiple underscores, pweese do not import me

async def get_engine() -> AsyncGenerator[AsyncEngine]:
	global __engine
	if __engine is None:
		__engine = AsyncEngine()
	
	yield __engine
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

Truthfully, this is a suboptimal solution. Our application only creates the engine when a handler that requires the dependency is called. Your application could start up, and things _seem_ alright, but it could then crash if you failed to get a connection for some reason. With the engine tied outside the lifecycle of the application, we don't get predictable teardowns, which has all the potential for side-effects.^[It's like unplugging a hard drive without first ejecting. Sure, you've done it for years and nothing bad has happened. But do you really want to rely on that?]

Some people attempt to solve this conundrum using [`contextvars`](https://github.com/fastapi/fastapi/discussions/8628). Contextvars scare me and I avoid them wherever possible. 

 Our database should live _immediately before_ and immediately _after_ FastAPI, like an outer layer. We initialize it when FastAPI starts up, and when we CTRL-C (aka `SIGTERM`), our database has the opportunity to clean itself up. It would be convenient if we could tie it to, say, the _lifespan_ of FastAPI...
# The right way with ASGI Lifespan

FastAPI features support for aptly-named `ASGI Lifespan` protocol, replacing the deprecated startup events. For example, here's a lifespan modified directly [from FastAPI's docs](https://fastapi.tiangolo.com/advanced/events/#lifespan).

```python
from contextlib import asynccontextmanager

engine: AsyncEngine = None

async def get_engine() -> AsyncGenerator[AsyncEngine]:
	yield engine

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
	global engine
	engine = AsyncEngine()
	yield
	await engine.dispose()
```

Pretty cool! A big improvement on our old code, as we can properly handle clean-ups. But it's still not optimal, as our handler still relies on the global state. Is it possible to make it, _not_?

Nested in the [ASGI spec](https://asgi.readthedocs.io/en/latest/specs/lifespan.html), there's an interesting trait of lifespans: when you `yield`, you can `yield` stuff from it. Instead of the defining a global, you can just,

```python
class AppState(TypedDict):
	engine: AsyncEngine

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[AppState]:
	engine = AsyncEngine()
	yield { "engine": engine }
	await engine.dispose()
```

And now, our engine is part of our application! To be more specific, it's part of the `ASGI Scope`. You can access it by simply defining our new session dependency like:

```python
from fastapi import Request

async def get_session(request: Request) -> AsyncGenerator[AsyncSession]:
	engine = request.scope["state"]["engine"]
	async with async_sessionmaker(engine) as session:
		yield session
```

And now, inside that same handler, we get a new session, initialized with a `shallow copy` of our engine (important for performance), that's tied to the lifespan of our FastAPI app. No dependency solving required, as the engine is associated with every request. 

When you ask FastAPI to shut down, FastAPI will clean itself up, and then the lifespan will pass its `yield` point, allowing the engine to `dispose` of itself. 

ASGI Lifespans are powerful! I wish more people knew about them. In general, you should associate stuff with your application rather than letting it live external to it. I throw in pretty much everything inside of it, including my application settings (of which I use `pydantic_settings`), and all my dependencies are just wrappers that pull directly from the ASGI scope. It also has the benefit of being far more testable, as you can just mock the underlying object injected into the lifespan rather than overriding the dependency itself. It also encourages you to think deeply about what the lifecycle of your application is, which I find has lead to more maintainable code.