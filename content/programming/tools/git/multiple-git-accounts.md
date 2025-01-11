---
title: Handling multiple git accounts
tags:
  - thoughts
---

Imagine the scenario: you have multiple github accounts, one for personal stuff, one for school, one for work stuff. Managing this stuff becomes a nightmare, and I'm sure y'all can relate to pushing with the wrong email, frantically having to amend, then `git config user.email`.

If you keep your separate "identities" separated via subfolder, there's a nice solution.

In your main `.gitconfig`:

```ini
[includeIf "gitdir:/my/path/"]
    path = /my/path/.gitconfig
```

Now, in `/my/path`, create a `.gitconfig`:

```ini
[user]
    name = "Your name"
    email = "youremail@email.com"
```

Everything nested under `/my/path` will use those git configs.

Note this doesn't solve the issue of "how do I authenticate to github with multiple accounts", which... is its own can of worms. Maybe someday!
