---
title: C++ doesn't have destructive moves.
tags:
  - thoughts
---
C++'s greatest innovation is RAII, "Resource Acquisition is Initialization." Despite its name, RAII has little to do with initialization, but rather destruction. In a RAII paradigm, an objects lifetime is tied to its scope, and its destructor is called when the scope ends. This is immensely helpful, as anyone who has seriously written C can tell you that a solid 90% of C code is just cleanup.

Unfortunately, C++'s ability to be wrong about everything means that it also suffers a big footgun with the lack of destructive moves. 

Now, I'm gonna tell you the reason this surprised me is that I'm really used to Rust these days. The concept of a "non-destructive" move doesn't really make sense to me, since I'm used to move semantics... moving data.

Here's a toy example of the problem:

```cpp
class MyVeryCoolObject {
public:
	MyVeryCoolObject() {
		std::cout << "I am initialized!" << std::endl;
	}
	~MyVeryCoolObject() {
		std::cout << "I have been destroyed :(" << std::endl;
	}
};

int main() {
	auto verycoolobject = MyVeryCoolObject();
	{
		auto coolerobject = std::move(verycoolobject);
	}
	return 0;
}
 ```

You may think the answer to this question is obvious:

```bash
I am intialized!
I have been destroyed :(
```

Since we moved the data, our `verycoolobject` no longer exists, its "guts" have been moved into the `coolerobject`. Then, at the end of the scope we created, `coolerobject`, which had the guts of the original object, will call its destructor. Then, at the end of the main block, since `myverycoolobject` is, uh, nothing, it will simply never call its destructor because it doesn't exist. Right. Right?

Here's what it actually outputs, compiled with `Apple clang version 15.0.0 (clang-1500.3.9.4)`.

```
I am intialized!
I have been destroyed :(
I have been destroyed :(
```
