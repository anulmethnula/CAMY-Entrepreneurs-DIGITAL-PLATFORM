# CAMY Code Style

Code should be written for the next developer to understand quickly.

## General rules

- Use consistent spacing and indentation.
- Prefer descriptive variable and function names.
- Put one logical operation on each line.
- Split long objects, arrays, function calls, and JSX elements across multiple lines.
- Use early returns to keep validation and error handling clear.
- Keep functions focused on one responsibility.
- Add comments only when they explain a business rule or a non-obvious decision.
- Avoid compressed one-line functions when they contain branching, validation, API calls, or state updates.

## JavaScript and React

- Use two spaces for indentation.
- Include spaces around operators and after commas.
- Use clear names such as `savedProfile` instead of generic names such as `data` or `result` when practical.
- Keep asynchronous API operations in readable `try/catch/finally` blocks.
- Place each JSX prop on its own line when an element becomes difficult to scan.

## PHP

- Use four spaces for indentation in newly written or substantially edited blocks.
- Put control-flow bodies on separate lines.
- Use prepared statements for values supplied by users.
- Keep validation, database changes, and response construction visually separated.

## Verification

After relevant changes, run:

```powershell
npm.cmd run build
npm.cmd run db:check
```

Run PHP syntax checks for every edited PHP file.
