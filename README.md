## Banana Comic

Minimal Next.js app cleaned for development with Bun and Tailwind CSS v4.

### Scripts (Bun)

```bash
bun run dev      # Start dev server
bun run build    # Build for production
bun run start    # Start production server
bun run check    # Lint + typecheck
```

### Structure

- `src/app/layout.tsx`: Root layout (arrow function)
- `src/app/page.tsx`: Minimal home page
- `src/app/globals.css`: Tailwind import + minimal base styles
- `postcss.config.mjs`: Tailwind v4 PostCSS plugin

### Notes

- Uses strict TypeScript with unused checks enabled.
- Unused template assets removed from `public/`.
