# lpictl - LPI Command Line Tool

CLI tool for LPI (Liminal Presence Interface) operations.

## Installation

```bash
npm install -g lpictl
```

## Commands

### validate

Validate LCE JSON against schema:

```bash
lpictl validate message.json
lpictl validate message.json --verbose
```

### encode

Encode LCE JSON to CBOR binary:

```bash
lpictl encode message.json message.cbor
```

### decode

Decode CBOR binary to LCE JSON:

```bash
# Print to stdout
lpictl decode message.cbor

# Save to file
lpictl decode message.cbor message.json
```

### size

Compare JSON vs CBOR sizes:

```bash
lpictl size message.json
```

Output:
```
Size comparison:
  JSON: 245 bytes
  CBOR: 178 bytes
  Savings: 67 bytes (27.35%)
```

### keygen

Generate Ed25519 key pair for signing:

```bash
# Generate in current directory
lpictl keygen

# Generate in specific directory
lpictl keygen ./keys
```

Generates:
- `lpi-private.key` - Keep this secure!
- `lpi-public.key` - Share this for verification

### sign

Sign LCE with private key:

```bash
# Print to stdout
lpictl sign message.json lpi-private.key

# Save to file
lpictl sign message.json lpi-private.key signed-message.json
```

### verify

Verify signed LCE:

```bash
lpictl verify signed-message.json lpi-public.key
```

Output:
```
✓ Valid signature
  The LCE is authentic and has not been tampered with.
```

### example

Generate example LCE JSON:

```bash
# Default (ask intent)
lpictl example

# Specific intent type
lpictl example example.json --type tell
lpictl example proposal.json --type propose
```

## Usage Examples

### Basic Workflow

```bash
# 1. Create example LCE
lpictl example my-message.json --type ask

# 2. Validate it
lpictl validate my-message.json

# 3. Compare sizes
lpictl size my-message.json

# 4. Encode to CBOR for efficient transmission
lpictl encode my-message.json my-message.cbor

# 5. Decode back to JSON
lpictl decode my-message.cbor decoded.json
```

### Cryptographic Signing Workflow

```bash
# 1. Generate keys
lpictl keygen

# 2. Create and sign message
lpictl example message.json
lpictl sign message.json lpi-private.key signed.json

# 3. Verify signature
lpictl verify signed.json lpi-public.key
```

### IoT/Embedded Use Case

```bash
# On development machine: create and encode
lpictl example sensor-data.json --type tell
lpictl validate sensor-data.json
lpictl encode sensor-data.json sensor-data.cbor

# Transfer sensor-data.cbor to IoT device (smaller size!)
# On IoT device: decode and process
lpictl decode sensor-data.cbor
```

## Exit Codes

- `0` - Success
- `1` - Error (invalid input, validation failed, etc.)

## Environment

Requires Node.js 18 or higher.

## License

MIT
