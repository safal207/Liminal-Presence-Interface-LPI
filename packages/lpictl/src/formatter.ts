/**
 * LCE Formatter - красивое представление
 */

import chalk from 'chalk';

export interface LCE {
  v: number;
  intent: {
    type: string;
    goal?: string;
  };
  affect?: {
    pad?: [number, number, number];
    tags?: string[];
  };
  meaning?: {
    topic?: string;
    ontology?: string;
  };
  trust?: {
    proof?: string;
    attest?: string[];
  };
  memory?: {
    thread?: string;
    t?: string;
    ttl?: string;
  };
  policy: {
    consent: string;
    share?: string[];
    dp?: string;
  };
  qos?: {
    coherence?: number;
    stability?: string;
  };
  trace?: {
    hop?: number;
    provenance?: string[];
  };
  sig?: string;
}

/**
 * Format LCE for display
 */
export function formatLCE(lce: LCE, options: { colors?: boolean } = {}): string {
  const useColors = options.colors !== false;
  const c = useColors ? chalk : noColors();

  const lines: string[] = [];

  // Header
  lines.push(c.bold.cyan('═══════════════════════════════════════════'));
  lines.push(c.bold.white('  🗝️  Liminal Context Envelope (LCE)'));
  lines.push(c.bold.cyan('═══════════════════════════════════════════'));
  lines.push('');

  // Version
  lines.push(c.gray('Version:') + ' ' + c.white(`v${lce.v}`));
  lines.push('');

  // Intent (required)
  lines.push(c.bold.yellow('🎯 Intent:'));
  lines.push(`  ${c.cyan('type:')} ${c.white(lce.intent.type)}`);
  if (lce.intent.goal) {
    lines.push(`  ${c.cyan('goal:')} ${c.white(lce.intent.goal)}`);
  }
  lines.push('');

  // Policy (required)
  lines.push(c.bold.green('🛡️  Policy:'));
  lines.push(`  ${c.cyan('consent:')} ${c.white(lce.policy.consent)}`);
  if (lce.policy.share && lce.policy.share.length > 0) {
    lines.push(`  ${c.cyan('share:')} ${c.white(lce.policy.share.join(', '))}`);
  }
  if (lce.policy.dp) {
    lines.push(`  ${c.cyan('dp:')} ${c.white(lce.policy.dp)}`);
  }
  lines.push('');

  // Affect (optional)
  if (lce.affect) {
    lines.push(c.bold.magenta('💗 Affect:'));
    if (lce.affect.pad) {
      const [p, a, d] = lce.affect.pad;
      lines.push(`  ${c.cyan('PAD:')} [${formatPAD(p, a, d, useColors)}]`);
    }
    if (lce.affect.tags && lce.affect.tags.length > 0) {
      lines.push(`  ${c.cyan('tags:')} ${c.white(lce.affect.tags.join(', '))}`);
    }
    lines.push('');
  }

  // Meaning (optional)
  if (lce.meaning) {
    lines.push(c.bold.blue('🧠 Meaning:'));
    if (lce.meaning.topic) {
      lines.push(`  ${c.cyan('topic:')} ${c.white(lce.meaning.topic)}`);
    }
    if (lce.meaning.ontology) {
      lines.push(`  ${c.cyan('ontology:')} ${c.white(lce.meaning.ontology)}`);
    }
    lines.push('');
  }

  // Memory (optional)
  if (lce.memory) {
    lines.push(c.bold.yellow('🧵 Memory:'));
    if (lce.memory.thread) {
      lines.push(`  ${c.cyan('thread:')} ${c.white(lce.memory.thread)}`);
    }
    if (lce.memory.t) {
      lines.push(`  ${c.cyan('timestamp:')} ${c.white(lce.memory.t)}`);
    }
    if (lce.memory.ttl) {
      lines.push(`  ${c.cyan('ttl:')} ${c.white(lce.memory.ttl)}`);
    }
    lines.push('');
  }

  // QoS (optional)
  if (lce.qos) {
    lines.push(c.bold.cyan('⚡ Quality of Service:'));
    if (lce.qos.coherence !== undefined) {
      lines.push(`  ${c.cyan('coherence:')} ${formatCoherence(lce.qos.coherence, useColors)}`);
    }
    if (lce.qos.stability) {
      lines.push(`  ${c.cyan('stability:')} ${c.white(lce.qos.stability)}`);
    }
    lines.push('');
  }

  // Trust (optional)
  if (lce.trust) {
    lines.push(c.bold.green('🔐 Trust:'));
    if (lce.trust.proof) {
      lines.push(`  ${c.cyan('proof:')} ${c.white(truncate(lce.trust.proof, 40))}`);
    }
    if (lce.trust.attest && lce.trust.attest.length > 0) {
      lines.push(`  ${c.cyan('attest:')} ${c.white(lce.trust.attest.join(', '))}`);
    }
    lines.push('');
  }

  // Trace (optional)
  if (lce.trace) {
    lines.push(c.bold.gray('🔍 Trace:'));
    if (lce.trace.hop !== undefined) {
      lines.push(`  ${c.cyan('hops:')} ${c.white(String(lce.trace.hop))}`);
    }
    if (lce.trace.provenance && lce.trace.provenance.length > 0) {
      lines.push(`  ${c.cyan('provenance:')} ${c.white(lce.trace.provenance.join(' → '))}`);
    }
    lines.push('');
  }

  // Signature (optional)
  if (lce.sig) {
    lines.push(c.bold.green('✍️  Signature:'));
    lines.push(`  ${c.white(truncate(lce.sig, 60))}`);
    lines.push('');
  }

  lines.push(c.bold.cyan('═══════════════════════════════════════════'));

  return lines.join('\n');
}

/**
 * Format PAD values with color coding
 */
function formatPAD(p: number, a: number, d: number, useColors: boolean): string {
  const c = useColors ? chalk : noColors();

  const pStr = p >= 0 ? c.green(`+${p.toFixed(2)}`) : c.red(p.toFixed(2));
  const aStr = a >= 0 ? c.green(`+${a.toFixed(2)}`) : c.red(a.toFixed(2));
  const dStr = d >= 0 ? c.green(`+${d.toFixed(2)}`) : c.red(d.toFixed(2));

  return `P:${pStr}, A:${aStr}, D:${dStr}`;
}

/**
 * Format coherence with visual indicator
 */
function formatCoherence(coherence: number, useColors: boolean): string {
  const c = useColors ? chalk : noColors();
  const percentage = (coherence * 100).toFixed(1) + '%';

  let colorFn;
  if (useColors) {
    if (coherence >= 0.8) colorFn = chalk.green;
    else if (coherence >= 0.5) colorFn = chalk.yellow;
    else colorFn = chalk.red;
  } else {
    colorFn = (s: string) => s;
  }

  const bars = Math.round(coherence * 10);
  const indicator = '█'.repeat(bars) + '░'.repeat(10 - bars);

  return `${colorFn(percentage)} ${c.gray(indicator)}`;
}

/**
 * Truncate long strings
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * No-color fallback
 */
function noColors() {
  const identity = (s: string) => s;
  return {
    bold: { cyan: identity, white: identity, yellow: identity, green: identity,
            magenta: identity, blue: identity, gray: identity },
    cyan: identity,
    white: identity,
    green: identity,
    yellow: identity,
    red: identity,
    gray: identity,
  };
}
