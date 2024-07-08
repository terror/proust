## proust

**proust** is a tool to help you learn more from static content.

> [!WARNING]
> This project is in very early stages. Breaking changes guaranteed.

<img align="right" width="500" alt="Screenshot 2024-07-08 at 2 37 59 AM" src="https://github.com/terror/proust/assets/31192478/bd9f048a-52fb-4c65-b8c7-3987b0485fad">


It runs fully client-side and in the browser. 

We abstract out the notion of a *workspace*, a place where you can load in static content from disk or from the web, having it fully indexed and ready to be interacted with.

As of now the only supported media types are PDF documents.

### Development

I'm solely using [React](https://react.dev/) and [TypeScript](https://www.typescriptlang.org/) to build this application. 

To get started contributing, first install dependencies:

```bash
bun install
```

...then startup the development server:

```bash
bun run dev
```

Check out `.env.example` for what environment variables need to be set.

Expect `http://localhost:5173/` to be in use and the app ready to view in a web browser.

## Prior Art

Got inspiration to work on this project from the book [Brave New Words: How AI Will Revolutionize Education](https://www.amazon.ca/Brave-New-Words-Revolutionize-Education/dp/0593656954) written by Salman Khan.
