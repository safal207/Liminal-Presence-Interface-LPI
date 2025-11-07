/**
 * @lri/anthropic - Anthropic SDK wrapper with LRI support
 *
 * Automatically enriches Anthropic (Claude) API calls with LRI semantic metadata:
 * - Intent signaling (ask, tell, propose, etc.)
 * - Affect awareness (emotional context)
 * - Consent policy (privacy settings)
 * - Session tracking (coherence, memory)
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk';
 * import { withLRI } from '@lri/anthropic';
 *
 * const client = withLRI(new Anthropic());
 *
 * const response = await client.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   lri: {
 *     intent: 'ask',
 *     affect: { tags: ['curious'] },
 *     consent: 'private'
 *   }
 * });
 * ```
 */

import type Anthropic from '@anthropic-ai/sdk';
import type {
  MessageCreateParams,
  MessageParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';

/**
 * LRI options for Anthropic requests
 */
export interface LRIOptions {
  /** Communicative intent */
  intent?: 'ask' | 'tell' | 'propose' | 'confirm' | 'notify' | 'sync' | 'plan' | 'agree' | 'disagree' | 'reflect';

  /** Emotional context */
  affect?: {
    /** Semantic tags (e.g., 'curious', 'frustrated') */
    tags?: string[];
    /** Pleasure-Arousal-Dominance values [-1, 1] */
    pad?: [number, number, number];
  };

  /** Privacy/consent level */
  consent?: 'private' | 'team' | 'public';

  /** Session/thread tracking */
  thread?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Extended message create params with LRI support
 */
export type LRIMessageCreateParams = MessageCreateParams & {
  /** LRI semantic metadata */
  lri?: LRIOptions;
};

/**
 * LRI-enhanced Anthropic client
 */
export interface LRIAnthropic extends Anthropic {
  messages: Anthropic['messages'] & {
    create(params: LRIMessageCreateParams): Promise<Message>;
  };
}

/**
 * Convert LRI options to system message content
 * This embeds LRI metadata in a way Claude can process
 */
function lriToSystemMessage(lri: LRIOptions): string {
  const parts: string[] = [];

  if (lri.intent) {
    parts.push(`Intent: ${lri.intent}`);
  }

  if (lri.affect?.tags && lri.affect.tags.length > 0) {
    parts.push(`Emotional context: ${lri.affect.tags.join(', ')}`);
  }

  if (lri.affect?.pad) {
    const [p, a, d] = lri.affect.pad;
    parts.push(`Affect (PAD): pleasure=${p.toFixed(2)}, arousal=${a.toFixed(2)}, dominance=${d.toFixed(2)}`);
  }

  if (lri.consent) {
    parts.push(`Privacy: ${lri.consent}`);
  }

  if (parts.length === 0) {
    return '';
  }

  return `[LRI Context] ${parts.join(' | ')}`;
}

/**
 * Inject LRI metadata into Anthropic system parameter
 */
function injectLRI(
  system: string | undefined,
  lri: LRIOptions
): string | undefined {
  const lriContext = lriToSystemMessage(lri);

  if (!lriContext) {
    return system;
  }

  if (system) {
    // Append to existing system message
    return `${system}\n\n${lriContext}`;
  }

  // Create new system message
  return lriContext;
}

/**
 * Wrap Anthropic client with LRI support
 *
 * @param client - Original Anthropic client instance
 * @param defaultLRI - Default LRI options for all requests
 * @returns LRI-enhanced Anthropic client
 *
 * @example
 * ```typescript
 * const client = withLRI(new Anthropic(), {
 *   consent: 'private', // Default to private
 *   affect: { tags: ['neutral'] }
 * });
 *
 * // LRI metadata automatically added
 * const response = await client.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   max_tokens: 1024,
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   lri: { intent: 'ask', affect: { tags: ['curious'] } }
 * });
 * ```
 */
export function withLRI(
  client: Anthropic,
  defaultLRI: LRIOptions = {}
): LRIAnthropic {
  // Create proxy that intercepts messages.create
  const originalCreate = client.messages.create.bind(client.messages);

  const enhancedCreate = (params: LRIMessageCreateParams): any => {
    // Merge default LRI with request-specific LRI
    const lri: LRIOptions = {
      ...defaultLRI,
      ...params.lri,
      affect: {
        ...defaultLRI.affect,
        ...params.lri?.affect,
        tags: [
          ...(defaultLRI.affect?.tags || []),
          ...(params.lri?.affect?.tags || []),
        ],
      },
    };

    // Inject LRI metadata into system parameter
    const enhancedSystem = injectLRI((params as any).system, lri);

    // Remove lri from params (Anthropic doesn't know about it)
    const { lri: _, ...anthropicParams } = params;

    // Call original Anthropic API with enhanced system
    return originalCreate({
      ...anthropicParams,
      system: enhancedSystem,
    } as any);
  };

  // Return proxied client
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'messages') {
        return new Proxy(target.messages, {
          get(messagesTarget, messagesProp) {
            if (messagesProp === 'create') {
              return enhancedCreate;
            }
            return Reflect.get(messagesTarget, messagesProp, messagesTarget);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as LRIAnthropic;
}

/**
 * Helper function to create common LRI intents
 */
export const intents = {
  /** Ask a question or request information */
  ask: (affect?: LRIOptions['affect']): LRIOptions => ({
    intent: 'ask',
    affect: affect || { tags: ['curious'] },
    consent: 'private',
  }),

  /** Provide information or state facts */
  tell: (affect?: LRIOptions['affect']): LRIOptions => ({
    intent: 'tell',
    affect: affect || { tags: ['neutral'] },
    consent: 'private',
  }),

  /** Suggest an action or approach */
  propose: (affect?: LRIOptions['affect']): LRIOptions => ({
    intent: 'propose',
    affect: affect || { tags: ['confident'] },
    consent: 'private',
  }),

  /** Reflect or reason about something */
  reflect: (affect?: LRIOptions['affect']): LRIOptions => ({
    intent: 'reflect',
    affect: affect || { tags: ['analytical'] },
    consent: 'private',
  }),
};

/**
 * Helper function for common affect states
 */
export const affects = {
  curious: { tags: ['curious'], pad: [0.3, 0.2, 0.1] as [number, number, number] },
  frustrated: { tags: ['frustrated'], pad: [-0.6, 0.4, -0.2] as [number, number, number] },
  confident: { tags: ['confident'], pad: [0.5, 0.3, 0.6] as [number, number, number] },
  urgent: { tags: ['urgent'], pad: [-0.2, 0.8, 0.3] as [number, number, number] },
  casual: { tags: ['casual'], pad: [0.4, -0.3, 0.0] as [number, number, number] },
  analytical: { tags: ['analytical'], pad: [0.0, 0.1, 0.2] as [number, number, number] },
  empathetic: { tags: ['empathetic'], pad: [0.3, -0.1, -0.2] as [number, number, number] },
  playful: { tags: ['playful'], pad: [0.7, 0.5, 0.2] as [number, number, number] },
};

// Export types
export type {
  MessageCreateParams,
  MessageParam,
  Message,
} from '@anthropic-ai/sdk/resources/messages';
