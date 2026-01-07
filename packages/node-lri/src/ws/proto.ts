export const DEFAULT_PROTO_VERSION = '0.1';

export function resolveProtoVersion(options: {
  lpiVersion?: string;
  lriVersion?: string;
}): string {
  return options.lpiVersion ?? options.lriVersion ?? DEFAULT_PROTO_VERSION;
}
