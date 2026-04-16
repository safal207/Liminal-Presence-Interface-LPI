// Single source of truth for protocol version defaults and resolution.
// Note: wire-level field remains `lri_version` for backwards compatibility.
export const DEFAULT_PROTO_VERSION = '0.1';

export function resolveProtoVersion(options: {
  lpiVersion?: string;
  lriVersion?: string;
}): string {
  return options.lpiVersion ?? options.lriVersion ?? DEFAULT_PROTO_VERSION;
}
