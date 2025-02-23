---
title: Notes on React's Rendering Model
tags:
  - notes
---

- **React Core:** Creates "stuff" on the page with Javascript. How? VDOM!
- **VDOM (Virtual DOM):**
  - In-memory representation of the actual DOM. Like a lightweight, optimized database for the UI.
  - Organized as a tree structure (components/DOM elements as nodes).
  - **Reconciliation:**
    - React compares the _new_ VDOM with the _previous_ VDOM when data changes (state, props, etc.).
    - Creates "patches" representing _minimum_ changes needed for the real DOM.
    - React uses smart heuristics (batching updates in React 18+, root-based comparisons) to minimize re-rendering time.
  - **VDOM Advantages:**
    - Sets a reasonable ceiling on rendering performance.
    - Can batch operations to avoid costly re-renders.
  - **VDOM Disadvantages:**
    - Inherently adds latency compared to direct DOM manipulation (due to comparison and patching).
    - _Never_ faster than directly manipulating the DOM. (Tradeoff: dev experience vs. raw speed)

## **Props, Re-renders, and the Prop-Drilling Problem**

- Props: How you pass data from parent to child components.
- Passed via _reference_ (pointers), _not_ value.
  - Good: Avoids data duplication, mutations propagate.
  - Bad: Hard to tell what _actually_ needs to re-render, causing performance issues.
- **Prop Drilling Scenario (A -> B -> C -> D):**

  - A holds data `x`, needs to pass it to D.
  - A passes `x` to B, B to C, C to D.
  - Only D _uses_ `x`, but A, B, C, and D _all_ re-render when `x` changes. _Why?!_
  - **Code Example:**

    ```javascript
    import React, { useState } from "react"

    const ComponentD = ({ x }) => {
      console.log("Component D rendered")
      return <div>Value of x: {x}</div>
    }

    const ComponentC = ({ x }) => {
      console.log("Component C rendered")
      return <ComponentD x={x} />
    }

    const ComponentB = ({ x }) => {
      console.log("Component B rendered")
      return <ComponentC x={x} />
    }

    const ComponentA = () => {
      const [x, setX] = useState(0)
      console.log("Component A rendered")

      return (
        <div>
          <button onClick={() => setX(x + 1)}>Increment x</button>
          <ComponentB x={x} />
        </div>
      )
    }
    ```

  - Clicking "Increment x" re-renders A, B, C, and D.
  - B and C don't even _use_ `x` directly!
  - **Reason:**
    - VDOM + pass-by-reference.
    - A's state update creates a _new reference_ for the `x` prop.
    - VDOM sees the `x` prop has changed for B and C (different reference).
    - Triggers re-render _even if the underlying value of_ `x` _is the same_.
    - This is inherent to JavaScript and React. React follows a top-down approach and will re-render the component which modified the state, as well as all it's children.

- **Implications of Prop Drilling:**
  - In larger apps, complex states passed down the tree can cause a cascade of re-renders.
  - Even _unaffected_ children re-render, creating a performance bottleneck.
  - Hard to debug due to unnecessary re-renders.
  - **Trade-off:** React prioritizes keeping the UI in sync with the state (even if it means unnecessary re-renders).
  - React's reconciliation is smart, but not _perfect_. It errs on the side of caution by re-rendering.

## **Why Should You Care?**

- Performance _does_ matter, even if people don't notice small FPS differences.
- It's hard to work your way out of performance issues _later_. Design for performance from the start.
- Prop drilling makes components _too coupled_.
- React should be about composition, pure functions (inputs -> outputs, no side effects).
- Prop drilling means a component is concerned with its parent's and children's responsibilities.
- Makes components less composable, less performant, harder to test.

## **What to Do?**

- _Lean on the work of others:_ Use libraries and established patterns! (Billions of dollars of dev-hours invested in this).
- Client-side State Management
- Server-side State Management
- Memoization

- **Sources:**
  - [https://www.joshwcomeau.com/react/why-react-re-renders/](https://www.joshwcomeau.com/react/why-react-re-renders/)
  - [https://react.dev/learn/render-and-commit](https://react.dev/learn/render-and-commit)
  - [https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/](https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/)
