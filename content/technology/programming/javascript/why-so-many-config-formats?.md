---
title: Why does Javascript have so many config formats?
tags:
  - thoughts
---
I've been learning Typescript recently. And I'm astonished at how many freaking configuration files I need.

Vite needs its own config file. Eslint needs its own configuration file. The configuration file formats aren't unified. Some of them are actual Javascript files, some of them are JSON files, some of them are YAML files.

Python may have its issues, but at least the community has agreed to let `pyproject.toml` be the source of truth. Flake8 tried to play games and has been taken over by `ruff`.
