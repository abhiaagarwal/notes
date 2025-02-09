---
title: Using `just` to properly tag and isolate docker compose projects
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

This is pretty neat, but it does mean that all your images are built with the tag `develop`. Let's say you switch to another branch, and you want to test the application there. You are _forced_ to rebuild, possibly `docker compose down -v` and lose your old image and state entirely if you want to switch back.

Instead, we can define the environment variable `TAG`, and then rewrite the docker compose to be:

```yaml
services:
    frontend:
        image: frontend:${TAG:-develop}
        # alternatively, force tag to be set with
        # image: frontend:${TAG?TAG not set}
        build:
            context: ./frontend
    backend:
        image: backend:${TAG:-develop}
        build:
            context: ./backend
```

We can instead do `TAG=my-branch docker compose build`, and docker compose will interpolate it for you. Still, not optimal. It involves typing _at least_ 4 extra characters, and if you're anything like me, you're going to forget more often than not. We _could_ export it globally, but global terminal variables tend to be scary.

Instead, we can use a [`justfile`](https://just.systems/man/en/) to perform a little bit of magic for us. A `justfile` is just a `makefile` without a million and a half footguns. I use them extensively and I love them. They also have a neat ability to set environment variables based on command execution.

```just
export TAG=`(git rev-parse --abbrev-ref HEAD)`

just build *FLAGS:
    docker compose build {{FLAGS}}

just up *FLAGS:
    docker compose up {{FLAGS}}
```

Pretty cool! Now, on `my-branch`, `docker compose build` will build our frontend and backend images and push them to our internal docker registry, correctly tagged with `my-branch`. This isn't as scary as it sounds in terms of space usage, as if your images are correctly layered, docker will de-duplicate the shared layers.

However, this could create docker tags that aren't syntactically valid, like if the branch is called `my/FEATURE-branch`. Instead, we can normalize it, following exactly what gitlab does to generate [`CI_COMMIT_REF_SLUG`](https://gitlab.com/gitlab-org/gitlab-runner/-/blame/af6932352f8ed15d1a6d9c786399607bc6be2c2d/Makefile.build.mk?page=1#L25).

```just
export TAG=`(git rev-parse --abbrev-ref HEAD | tr '[:upper:]' '[:lower:] | cut -c -63 | sed -E 's/[^a-z0-9-]+/-/g' | sed -E 's/^-*([a-z0-9-]+[a-z0-9])-*$$/\1/g')`

just build *FLAGS:
    docker compose build {{FLAGS}}

just up *FLAGS:
    docker compose up {{FLAGS}}
```

This branch would get normalized to `my-feature-branch`, all lowercase.
# Appendix

## Parity with CI

Let's say you have a CI/CD process that builds containers and pushes them to your Gitlab/Github container registry. Assuming your CI tags and your docker compose tags are identical, you can pull your images directly from CI, bypassing a potentially expensive build step.

```yaml
name: my-project-${TAG:-develop}
services:
    frontend:
        image: ${REGISTRY}/frontend:${TAG:-develop}
        build:
            context: ./frontend
    backend:
        image: ${REGISTRY}/backend:${TAG:-develop}
        build:
            context: ./backend
```

Where `${REGISTRY}` is `gitlab.com:5050/my/project/registry` or whatever. Now, with a modified `justfile`:

```just
export TAG=`(git rev-parse --abbrev-ref HEAD | tr '[:upper:]' '[:lower:] | cut -c -63 | sed -E 's/[^a-z0-9-]+/-/g' | sed -E 's/^-*([a-z0-9-]+[a-z0-9])-*$$/\1/g')`
export REGISTRY=gitlab.com:5050/my/project/registry # note that I would probably set this in a .env file since it's static

just pull *FLAGS:
    docker compose up {{FLAGS}}

just up *FLAGS:
    docker compose up {{FLAGS}}
```

`just pull` can pull the base images, potentially saving a huge amount of time on initial build if layering is done correctly.

For a bonus-bonus round, if you use buildkit caching ([github](https://docs.docker.com/build/ci/github-actions/cache/) and [gitlab](https://docs.gitlab.com/ee/ci/docker/docker_layer_caching.html)), you can use the `cache_from` directive to save yourself some substantial time by pre-seeding your cache with dependencies in python, typescript, etc (again, assuming you are cache-mounting your layers correctly).

```yaml
name: my-project-${TAG:-develop}
services:
    frontend:
        image: ${REGISTRY}/frontend:${TAG:-develop}$
        build:
            context: ./frontend
        cache_from:
        - ${REGISTRY}/frontend:buildcache
    backend:
        image: ${REGISTRY}/backend:${TAG:-develop}$
        build:
            context: ./backend
        cache_from:
        - ${REGISTRY}/frontend:buildcache
```
## Using the tag to achieve pure isolation

If you're running a multiple copies on your machine, say, to test multiple branches, you can use the `name` top-level element to achieve pure isolation between each stack. 

```yaml
name: my-project-${TAG:-develop}
services:
    frontend:
        image: frontend:${TAG:-develop}$
        build:
            context: ./frontend
    backend:
        image: backend:${TAG:-develop}$
        build:
            context: ./backend
```

Let's say you're doing feature development on tag `my-feature`, but you need to switch to a new branch `my-hotfix` . You can `git switch`, and then with `just up`, it creates a set of containers entirely prefixed with `my-project-${TAG}` without conflicting with the original set of containers. If your spin up process is expensive, this can be a huge time-saver. 

Additionally, if you have a local docker volume, say to persist database data, the volume is created with `my-project-${TAG}` as its prefix. Your data won't be polluted between branches, so you can perform database migrations, seeding, etc without getting into a funky state.git p