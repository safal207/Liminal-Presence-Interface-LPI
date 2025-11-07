# @lri/anthropic Demo

Interactive demos showing how **LRI (Liminal Resonance Interface)** improves Anthropic Claude interactions.

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.example .env
# Edit .env and add your key

# 3. Run demos
npm run demo
```

## 📋 Demos

### Demo 1: Basic Usage
Shows how to add intent and affect to Claude calls.

### Demo 2: Comparison
Side-by-side: plain Anthropic vs LRI-enhanced. See the difference!

### Demo 3: Emotional Adaptation
Same question, different emotional states → different Claude responses.

### Demo 4: Session Tracking
Multi-turn conversation with context preservation.

### Demo 5: Extended Thinking
Claude's analytical reasoning with LRI context awareness.

## 🎯 What You'll Learn

- ✅ How to wrap Anthropic client with LRI
- ✅ Using intent types (ask, tell, propose, reflect)
- ✅ Adding emotional context (affect tags)
- ✅ Privacy control (consent levels)
- ✅ Session/thread tracking
- ✅ Claude's extended thinking with LRI

## 💡 Key Insights

**Without LRI:**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'My code crashed!' }]
});
// Claude doesn't know if you're frustrated or just informing
```

**With LRI:**
```typescript
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'My code crashed!' }],
  lri: {
    intent: 'ask',  // You want help
    affect: { tags: ['frustrated', 'urgent'] },  // You're stressed
    consent: 'private'  // Keep this private
  }
});
// Claude adapts its tone and urgency accordingly
```

## 🧪 Expected Results

You'll see Claude's responses change based on:
- **Intent**: Asking vs telling gets different response styles
- **Affect**: Frustrated users get more empathetic, direct help
- **Context**: Multi-turn conversations maintain coherence

## 🆚 Claude vs GPT

Both `@lri/anthropic` and `@lri/openai` use the same LRI interface:

```typescript
// Same LRI code works for both!
const lriOptions = {
  intent: 'ask',
  affect: { tags: ['curious'] },
  consent: 'private'
};

// OpenAI
await openaiClient.chat.completions.create({ ..., lri: lriOptions });

// Anthropic
await anthropicClient.messages.create({ ..., lri: lriOptions });
```

**Switch between AI providers without changing your LRI code!**

## 📚 Learn More

- [@lri/anthropic Package](../../packages/lri-anthropic)
- [LRI Documentation](https://lri.dev/docs)
- [Anthropic API](https://docs.anthropic.com/)

---

🪷 **Part of the LRI project** - Layer 8 semantic protocol for human-AI communication
