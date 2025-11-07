/**
 * @lri/anthropic Demo
 *
 * Showcases different use cases:
 * 1. Basic usage with intent/affect
 * 2. Comparing responses with/without LRI
 * 3. Adapting to emotional state
 * 4. Session tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import { withLRI, intents, affects } from '@lri/anthropic';
import 'dotenv/config';

// Setup
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const client = withLRI(anthropic);

const MODEL = 'claude-3-5-sonnet-20241022';
const MAX_TOKENS = 1024;

console.log('═══════════════════════════════════════════════════════');
console.log('🧠 @lri/anthropic Demo - Layer 8 for Claude');
console.log('═══════════════════════════════════════════════════════\n');

/**
 * Demo 1: Basic Usage
 */
async function demo1Basic() {
  console.log('🎯 Demo 1: Basic Usage with Intent & Affect\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'user', content: 'Explain recursion in programming' }
    ],
    lri: {
      intent: 'ask',
      affect: { tags: ['curious', 'confused'] },
      consent: 'private'
    }
  });

  console.log('User: Explain recursion in programming');
  console.log('LRI: intent=ask, affect=curious,confused\n');
  console.log('Claude:', response.content[0].text);
  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demo 2: Compare with/without LRI
 */
async function demo2Comparison() {
  console.log('🔬 Demo 2: Comparison - With vs Without LRI\n');

  const question = 'My code crashed again!';

  // Without LRI
  console.log('❌ WITHOUT LRI (plain Anthropic):');
  console.log(`User: ${question}\n`);

  const plain = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: 'You are a helpful coding assistant.',
    messages: [
      { role: 'user', content: question }
    ]
  });

  console.log('Claude:', plain.content[0].text.substring(0, 200) + '...\n');

  // With LRI
  console.log('✅ WITH LRI (intent + frustration):');
  console.log(`User: ${question}`);
  console.log('LRI: intent=ask, affect=frustrated,urgent\n');

  const lri = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: 'You are a helpful coding assistant.',
    messages: [
      { role: 'user', content: question }
    ],
    lri: {
      intent: 'ask',
      affect: affects.frustrated,
      consent: 'private'
    }
  });

  console.log('Claude:', lri.content[0].text.substring(0, 200) + '...\n');
  console.log('👀 Notice: LRI response is more empathetic and direct');
  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demo 3: Emotional Adaptation
 */
async function demo3Emotional() {
  console.log('💭 Demo 3: Emotional State Adaptation\n');

  const scenarios = [
    {
      state: 'Curious beginner',
      content: 'How do I use async/await?',
      lri: intents.ask({ tags: ['curious', 'eager'] })
    },
    {
      state: 'Frustrated developer',
      content: 'How do I use async/await?',
      lri: intents.ask(affects.frustrated)
    },
    {
      state: 'Confident reviewer',
      content: 'How do I use async/await?',
      lri: intents.ask(affects.confident)
    }
  ];

  for (const scenario of scenarios) {
    console.log(`📍 Scenario: ${scenario.state}`);
    console.log(`User: ${scenario.content}`);
    console.log(`LRI: intent=${scenario.lri.intent}, affect=${scenario.lri.affect?.tags.join(',')}\n`);

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: 'You are a programming teacher.',
      messages: [
        { role: 'user', content: scenario.content }
      ],
      lri: scenario.lri
    });

    console.log('Claude:', response.content[0].text.substring(0, 150) + '...\n');
  }

  console.log('👀 Notice: Claude adapts tone based on emotional state');
  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demo 4: Session Tracking
 */
async function demo4Session() {
  console.log('🧵 Demo 4: Session/Thread Tracking\n');

  const thread = crypto.randomUUID();
  console.log(`Thread ID: ${thread}\n`);

  // Multi-turn conversation
  const turns = [
    {
      user: 'I need help with my React app',
      lri: intents.ask()
    },
    {
      user: 'State management is confusing me',
      lri: { intent: 'tell', affect: affects.frustrated, thread }
    },
    {
      user: 'OK, so I should use useState() for component state?',
      lri: { intent: 'sync', affect: { tags: ['curious', 'understanding'] }, thread }
    }
  ];

  let conversationHistory = [];

  for (const turn of turns) {
    console.log(`👤 User: ${turn.user}`);

    if (turn.lri) {
      const affectStr = turn.lri.affect?.tags?.join(',') || 'neutral';
      console.log(`   LRI: intent=${turn.lri.intent}, affect=${affectStr}`);
    }

    conversationHistory.push({
      role: 'user',
      content: turn.user
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: 'You are a React expert.',
      messages: conversationHistory,
      lri: turn.lri
    });

    const claudeResponse = response.content[0].text;
    console.log(`🧠 Claude: ${claudeResponse.substring(0, 100)}...\n`);

    conversationHistory.push({
      role: 'assistant',
      content: claudeResponse
    });
  }

  console.log('👀 Notice: Conversation context maintained across turns');
  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Demo 5: Claude's Thinking (Extended Thinking)
 */
async function demo5Thinking() {
  console.log('🤔 Demo 5: Claude with Extended Thinking (LRI-aware)\n');

  console.log('User: Solve this logic puzzle: If all bloops are razzies and all razzies are lazzies, are all bloops definitely lazzies?');
  console.log('LRI: intent=ask, affect=analytical,curious\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: 'Solve this logic puzzle: If all bloops are razzies and all razzies are lazzies, are all bloops definitely lazzies?'
      }
    ],
    lri: {
      intent: 'ask',
      affect: affects.analytical,
      consent: 'private'
    }
  });

  console.log('Claude:', response.content[0].text);
  console.log('\n' + '─'.repeat(60) + '\n');
}

/**
 * Run all demos
 */
async function runDemos() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY not set');
    console.log('Create a .env file with: ANTHROPIC_API_KEY=your-key-here\n');
    process.exit(1);
  }

  try {
    await demo1Basic();
    await demo2Comparison();
    await demo3Emotional();
    await demo4Session();
    await demo5Thinking();

    console.log('✅ All demos completed!');
    console.log('\n🪷 LRI brings semantic clarity to Claude communication\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.status === 401) {
      console.log('\n💡 Check your ANTHROPIC_API_KEY in .env file\n');
    }
  }
}

runDemos();
