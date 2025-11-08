# lrictl - LRI Command Line Tool

CLI tool for LRI (Liminal Resonance Interface) operations.

## Installation

```bash
npm install -g lrictl
```

## Commands

### validate

Validate LCE JSON against schema:

```bash
lrictl validate message.json
lrictl validate message.json --verbose
```

### encode

Encode LCE JSON to CBOR binary:

```bash
lrictl encode message.json message.cbor
```

### decode

Decode CBOR binary to LCE JSON:

```bash
# Print to stdout
lrictl decode message.cbor

# Save to file
lrictl decode message.cbor message.json
```

### size

Compare JSON vs CBOR sizes:

```bash
lrictl size message.json
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
lrictl keygen

# Generate in specific directory
lrictl keygen ./keys
```

Generates:
- `lri-private.key` - Keep this secure!
- `lri-public.key` - Share this for verification

### sign

Sign LCE with private key:

```bash
# Print to stdout
lrictl sign message.json lri-private.key

# Save to file
lrictl sign message.json lri-private.key signed-message.json
```

### verify

Verify signed LCE:

```bash
lrictl verify signed-message.json lri-public.key
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
lrictl example

# Specific intent type
lrictl example example.json --type tell
lrictl example proposal.json --type propose
```

## Usage Examples

### Basic Workflow

```bash
# 1. Create example LCE
lrictl example my-message.json --type ask

# 2. Validate it
lrictl validate my-message.json

# 3. Compare sizes
lrictl size my-message.json

# 4. Encode to CBOR for efficient transmission
lrictl encode my-message.json my-message.cbor

# 5. Decode back to JSON
lrictl decode my-message.cbor decoded.json
```

### Cryptographic Signing Workflow

```bash
# 1. Generate keys
lrictl keygen

# 2. Create and sign message
lrictl example message.json
lrictl sign message.json lri-private.key signed.json

# 3. Verify signature
lrictl verify signed.json lri-public.key
```

### IoT/Embedded Use Case

```bash
# On development machine: create and encode
lrictl example sensor-data.json --type tell
lrictl validate sensor-data.json
lrictl encode sensor-data.json sensor-data.cbor

# Transfer sensor-data.cbor to IoT device (smaller size!)
# On IoT device: decode and process
lrictl decode sensor-data.cbor
```

## Exit Codes

- `0` - Success
- `1` - Error (invalid input, validation failed, etc.)

## Environment

Requires Node.js 18 or higher.

## License

MIT
