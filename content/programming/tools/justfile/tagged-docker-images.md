---
title: Using `just` to properly tag docker compose images
tags:
  - observations
---
You're developing a dockerized application, so you have a docker compose stack.

```yaml
services:
    frontend:
        image: 'frontend:develop'
        build:
            context: ./frontend
    backend:
        image: 'backend:develop'
        build:
            context: ./backend
```

This is pretty neaat, but it does mean that all your images are built with the tag `develop`. Let's say you switch to another branch, and you want to test the application there. You are _forced_ to rebuild, and then you lose your old image entirely.

A common workaround is to define an environment variable `TAG`, and then rewrite the docker compose to be:

```yaml
services:
    frontend:
        image: 'frontend:${TAG:-develop}$'
        build:
            context: ./frontend
    backend:
        image: 'backend:${TAG:-develop}$'
        build:
            context: ./backend
```

We can instead do `TAG=my-branch docker compose build` ! Still, not optimal. It involves typing _at least_ 4 extra characters, and if you're anything like me, you're going to do it less often than not. We _could_ export it globally, but I personally tend to avoid setting env variables.

Instead, we can use a justfile to calculate the tag dynamically and set the env variable.

```just
export TAG=`(git rev-parse --abbrev-ref HEAD)`

just up *FLAGS:
    docker compose up {{FLAGS}}
```

Pretty cool! But this could create docker tags that aren't syntactically valid, like if the branch is called `my/FEATURE-branch`. Instead, we can normalize it, following exactly what gitlab does to generate [`CI_COMMIT_REF_SLUG`](https://gitlab.com/gitlab-org/gitlab-runner/-/blame/af6932352f8ed15d1a6d9c786399607bc6be2c2d/Makefile.build.mk?page=1#L25).

```just
export TAG=`(git rev-parse --abbrev-ref HEAD | tr '[:upper:]' '[:lower:] | cut -c -63 | sed -E 's/[^a-z0-9-]+/-/g' | sed -E 's/^-*([a-z0-9-]+[a-z0-9])-*$$/\1/g')`

just up *FLAGS:
    docker compose up {{FLAGS}}
```

This branch would get normalized to `my-feature-branch`, all lowercase.