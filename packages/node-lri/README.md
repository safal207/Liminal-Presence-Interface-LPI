# node-lri

Node.js SDK for Liminal Resonance Interface (LRI)

## Installation

```bash
npm install node-lri
```

## Quick Start

### Express Middleware

```typescript
import express from 'express';
import { lriMiddleware, LCE } from 'node-lri';

const app = express();

// Add LRI middleware
app.use(lriMiddleware({
  required: false,  // Make LCE optional
  validate: true,   // Validate against schema
}));

app.get('/api/data', (req: any, res) => {
  const lce = req.lri?.lce;

  // Access LCE metadata
  console.log('Intent:', lce?.intent.type);
  console.log('Affect:', lce?.affect?.tags);
  console.log('Thread:', lce?.memory?.thread);

  res.json({ ok: true });
});

app.listen(3000);
```

### Creating LCE Headers

```typescript
import { createLCEHeader, LCE } from 'node-lri';

const lce: LCE = {
  v: 1,
  intent: {
    type: 'tell',
    goal: 'Provide data'
  },
  policy: {
    consent: 'private'
  }
};

// Create Base64 header
const header = createLCEHeader(lce);

// Add to response
res.setHeader('LCE', header);
```

### Validation

```typescript
import { validateLCE } from 'node-lri';

const result = validateLCE(lceData);

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## API Reference

### Types

- `LCE` - Liminal Context Envelope interface
- `Intent` - Communicative intent
- `Affect` - Emotional context
- `Policy` - Privacy/consent policy
- `Memory` - Session context
- And more...

### Functions

#### `lriMiddleware(options?)`

Express middleware for LRI support.

**Options:**
- `required?: boolean` - Require LCE header (default: false)
- `headerName?: string` - Header name (default: "LCE")
- `validate?: boolean` - Validate schema (default: true)

#### `createLCEHeader(lce: LCE): string`

Create Base64-encoded LCE header.

#### `validateLCE(lce: unknown): ValidationResult`

Validate LCE against JSON Schema.

## Examples

See [examples/express-app](../../examples/express-app) for a complete example.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## License

MIT - See [LICENSE](../../LICENSE)
