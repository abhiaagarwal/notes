---
tags:
  - thoughts
title: "`basic_fstream` will sometimes fail. And it won't tell you."
---

I have a file that I'm streaming from a gRPC endpoint as stream of bytes (that could be of arbitrary size, but I aligned to 1024kb). I want to replicate those bytes on the filesystem.

Easy enough, we have to open our file with `std::ios::binary` to indicate that we're dealing with binary data, that we don't want our file to treat any characters like they mean anything. I'll give you a `std::vector` of some data, it holds its size, you throw it in the file via `fstream::write`. Easy enough, shouldn't be any footguns, right???

Since they are bytes, I don't want to use `char` (ie `int8_t`) and instead use the standard `uint8_t` (which in more modern c++ versions, would be `std::byte`, but I'm working with c++14). Easy enough, I simply specialize `fstream` with the underlying `basic_fstream` as `basic_fstream<std::uint8_t>`. Right, right???

Alright, before I get into this stupid footgun, I also want to point out that gRPC represents the protobuf datatype `bytes` as a `std::string`. I can understand why they did this, technically, since a `std::string` is just a `const char*` with a little bit of metadata so we can store `\O` characters inside of it. It should probably be an `std::vector<uint8_t>` (or `std::byte`) to represent that it isn't text content, but whatever. [Here's an issue for this](https://github.com/protocolbuffers/protobuf/issues/5431). Just means we have to use a lot of nasty `reinterpret_cast`s.

Anyways, here's something cool. If you attempt to write to open a given file as an `basic_ifstream<std::uint8_t>`, it works. The error bit isn't flipped. Now, if you attempt to write to it, it will fail.

```cpp
using binary_fstream = std::basic_ifstream<std::uint8_t>;

binary_fstream file("binary.dat", std::ios::out | std::ios::in | std::ios::binary);
if(file.good()) {
	std::cout << "Our file is good, why are you asking?" << std::endl;
}

std::vector<std::uint8_t> buffer = { ... }
file.write(buffer.data(), static_cast<long>(buffer.size()));
if(file.good()) {
	std::cout << "Our write totally suceeded, right?" << std::endl;
}
```
