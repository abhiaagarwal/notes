---
title: Why does Javascript have so many config formats?
tags:
  - thoughts
---
I've been learning Typescript recently. I kinda love it in all honesty! I was turned off from Javascript because of the lack of a type system, but Typescript's is *very* strong and ergonomic. 

But. I'm astonished at how many freaking configuration files I need.

Vite needs its own config file. Eslint needs its own configuration file. The configuration file formats aren't unified. Some of them are actual Javascript files, some of them are JSON files, some of them are YAML files.

Python may have its issues, but at least the community has agreed to let `pyproject.toml` be the source of truth. flake8 [tried to play games](https://github.com/PyCQA/flake8/issues/234) and has been taken over by `ruff`. Why the hell are we allowing the execution of code in a configuration file that should be invariant to the actual application, does anyone realize how much of a security nightmare that is?

I'm loving the devex of Typescript, but I really can't get over this. C'mon, we need a dictator, not even benevolent, to support an unified packing format like `pyproject.toml`. Please, for the love of god, what are we doing here?
