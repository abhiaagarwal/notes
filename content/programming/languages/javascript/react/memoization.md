---
title: Notes on React Memoization
tags:
  - notes
---

- **What is Memoization?**

  - It's like a cheat sheet for expensive function calls. We cache the result and reuse it if the same inputs come up again. Classic example: Fibonacci numbers.

- **Memoization in React:**
  - Optimizes component re-renders. React can skip re-rendering if a component's props haven't meaningfully changed.
  - React caches the VDOM representation and checks if it's valid before re-rendering. Cache hit = reuse!
  - **Important:** You have to tell React explicitly to do this. Otherwise, it'll just re-render automatically.
  - Performance gains are usually significant for larger components, smaller returns on small components. Since past render trees need to be kept to reconcile, memory usage is free.

## How to Memoize (the Fun Stuff)

- **`React.memo`**

  - A higher-order component for memoizing functional components.
  - Performs a _shallow_ comparison of props (checks if references have changed, not deep equality).
  - If props haven't changed by reference, React skips the re-render.
  - Great for list items in larger lists where individual values might not change.

  ```javascript
  import React, { memo } from "react"

  const MyComponent = memo(({ propA, propB }) => {
    console.log("MyComponent rendered")
    return (
      <div>
        {propA} - {propB}
      </div>
    )
  })
  ```

  - `MyComponent` re-renders only if `propA` or `propB` change _by reference_.

- **`useMemo`**

  - Memoizes the _result_ of a function.
  - Useful for expensive calculations you don't want to run on every render.
  - Takes a callback function and an array of dependencies. Recomputes only when dependencies change.

  ```javascript
  import React, { useState, useMemo } from "react"

  const MyComponent = ({ data }) => {
    const [count, setCount] = useState(0)
    const expensiveValue = useMemo(() => {
      console.log("expensive calculation ran")
      let result = data.reduce((acc, x) => acc + x, 0)
      return result
    }, [data])

    return (
      <>
        <div>{expensiveValue}</div>
        <button onClick={() => setCount(count + 1)}>Increment count</button>
      </>
    )
  }
  ```

  - Without `useMemo`, incrementing `count` would re-run the expensive calculation. With it, the calculation is cached and reused.

- **`useCallback`**

  - Memoizes a _function_ itself.
  - CRUCIAL when passing functions as props. If you don't memoize and create a new function on every render, the child component will re-render even if it's memoized!
  - `useCallback` creates a memoized reference to the callback, based on its dependencies.

  ```javascript
  import React, { useState, useCallback } from "react"

  const MyComponent = ({ onClick }) => {
    console.log("MyComponent rendered")
    return <button onClick={onClick}>Click Me</button>
  }

  const MyParent = () => {
    const [count, setCount] = useState(0)
    const handleClick = useCallback(() => {
      setCount(count + 1)
    }, [count])

    return (
      <>
        <MyComponent onClick={handleClick} />
        {count}
      </>
    )
  }
  ```

  - `handleClick` gets the same reference as long as `count` doesn't change, preventing `MyComponent` from unnecessary re-renders.
  - **Rule of thumb:** If passing a callback as a prop, almost always use `useCallback`. Low downside, high potential upside.

## The Gotchas: Why Not Memoize _Everything_?

- **Overhead:** Memoization isn't free!
  - Shallow comparison of props can be expensive, especially for complex props.
  - For simple components, the comparison overhead can be _more_ costly than just re-rendering. Javascript is fast!
  - Complex props often indicate deeper problems in data structure or component coupling.
- **When to Use:**
  - Great as a default action, but more useful for dealing with prop drilling and other state-related weirdness.
  - Really necessary as a performance booster if you have complicated logic or are rendering large trees.
  - Ideally, memoization shouldn't be _necessary_-- it is a signal that there are other optimizations to be made. But the real world is complex, and memoization is often needed.
  - Memoization should be done _after_ other optimizations have been made.

## The Future: The React Compiler

- React is working on an optimizing compiler that will automatically manage memoization! No more manual `React.memo`, `useMemo`, or `useCallback`!
- It'll analyze your code (that _correctly_ uses the rules of React), understand data dependencies, and add memoization during the build step.
- Won't fix messy code, and won't memoize non-compliant code.
- If you're already following React best practices, the compiler will skip a lot of manual work and give you _better_ performance than hand-written memoization. The react compiler and its philosophy are likely the future of React.
- In Beta as of 12/11/24, Release Candidate coming soon. [https://react.dev/learn/react-compiler](https://react.dev/learn/react-compiler)

## Sources:

- [https://react.dev/learn/react-compiler](https://react.dev/learn/react-compiler)
- [https://attardi.org/why-we-memo-all-the-things/](https://attardi.org/why-we-memo-all-the-things/)
- [https://tonyalicea.dev/blog/understanding-react-compiler/](https://tonyalicea.dev/blog/understanding-react-compiler/) (very very very well written!!)
- [https://kentcdodds.com/blog/usememo-and-usecallback](https://kentcdodds.com/blog/usememo-and-usecallback)
