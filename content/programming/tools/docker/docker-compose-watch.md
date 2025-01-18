---
title: In praise of `docker compose up --watch`
---
I'm a big believer in the [12 factor app](https://12factor.net/), and especially [Rule 10 — Keep development, staging, and production as similar as possible](https://12factor.net/dev-prod-parity). I love developing inside a `docker compose` stack, which assuming a containerized deployment (yes, even with kubernetes), exactly matches the production environment.

This doesn't seem like a big boon assuming good DevOps practice, but it comes useful, _especially_ in an environment that demands compliance. If you're developing with AuthN/Z in mind, just have your production IDP like Keycloak running directly on your machine instead of putting auth backdoors in your code. Every override you have in your codebase per environment is a potential misconfiguration away from blowing up the world.

This does come with a downside — how can I develop dynamically? Containers by design are supposed to be **stateless**. Being able to modify the code and then see it reflected instantly is an important tool for languages like python, typescript, etc, in that you trade performance for faster iteration, as developer time is your most expensive commodity. 