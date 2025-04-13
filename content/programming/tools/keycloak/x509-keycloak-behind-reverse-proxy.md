---
title: x509 client authentication/mTLS for Keycloak behind a reverse proxy.
---
I had to solve an interesting problem recently:

- I have a keycloak instance, living in a docker compose stack / kubernetes deployment.
- The keycloak instance DOES NOT handle its own TLS, instead deferring TLS termination to the reverse proxy.
- The goal is to have keycloak authenticate with mTLS and use the specified x509 id if it maps to authenticate an user without an username/password.

This was surprisingly difficult, and took me about three or four hours of fiddling to figure this out.