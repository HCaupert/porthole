## Code Style

- Make clean code and simple code. Do not over-engineer, stay KISS
- Code should be read as it executes. Keep orchestration at one level of abstraction. Express meaningful steps as named functions, with implementation details inside those functions. Do not make 35 micro functions/methods...
- Reuse code, dont repeat yourself
- Always aim to have a single source of truth
- Infer types as much as possible, but use explicit types to model a contract.
- Never make temporary stuff. Prefer not doing anything.
- Do not be defensive, don't overcheck, don't try catch etc... without a good (the user telling to) reason.
- Keep most things vanilla until there is a real need. Default behavior from libraries, framework etc... Should be kept, unless explicitly told otherwise.
- Keep implementations minimal within clear responsibility boundaries. A distinct responsibility with an established contract deserves its own type and implementation (that might be inferred), even with a single caller.
- Embrace the language, tools, framework and libraries before reinventing the wheel.
- If the current implementation does not fit the new needs, rework it first.
- Add code, configuration, or special handling only when the user requested the behavior or it is necessary to make the requested behavior work. Leave unrequested edge cases to the existing behavior. A conceivable case is not a requirement.
- Do not add code comments by default.

## Project

- Porthole is generic. Nothing in the code refers to one product or domain. Domains are config.
- Auth and exposure are outside the app. A tunnel and an access layer sit in front of it.
- `src/shared/domain.ts` holds the domain model (Zod schemas). The server and the UI both import it.
- `src/server/` is the backend. `server.ts` is the production entry. It wraps the TanStack Start handler with host routing and WebSocket proxying.
- `src/routes/` and `src/components/` are the UI (TanStack Start). The UI reads the data through `/api`.
- The routes of the API are in `src/server/api.ts`. They generate `/api/openapi.json` and `/llms.txt`. Put the curl example of a route in its `describeRoute` description.

## Linting and formatting

- After making code changes, run `bun fix`.
- Before finishing, run `bun check`.
- Run `bun test` for the unit tests and `bun run smoke` against a running instance.
