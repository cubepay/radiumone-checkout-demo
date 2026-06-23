# Security Policy

## Scope

This repository contains **demo/example code only**. It is not the HPP itself.

In-scope for this repo:
- Security issues in `examples/html-vanilla/server.mjs` or `examples/react-nextjs/` that could affect developers who copy the code into a production context (e.g. open-redirect injection, secret leakage pattern, timing-unsafe HMAC comparison).

Out of scope:
- Vulnerabilities in the RadiumOne Checkout HPP product itself — report those to the HPP team directly.
- Generic Node.js / Next.js vulnerabilities with upstream fixes already available.

## Reporting

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@cubepay.com** with:
- A description of the vulnerability and affected file(s).
- Steps to reproduce.
- Suggested fix if you have one.

We aim to acknowledge reports within 2 business days and resolve confirmed issues within 14 days.
