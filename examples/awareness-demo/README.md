# Awareness Layer Demo

Demonstrates the **Awareness Layer** - a Padmasambhava-inspired system for tracking the quality of mindful presence in conversation.

## What is Awareness?

Inspired by Buddhist teachings on mindfulness, the Awareness Layer tracks four dimensions of presence in conversation:

- **Presence** (0-1): "Here and now" quality - measured by timing consistency and recency
- **Clarity** (0-1): Communication clearness - based on semantic alignment and coherence
- **Distraction** (0-1): Scattered attention - topic jumping and intent chaos (lower is better)
- **Engagement** (0-1): Depth of involvement - message frequency and response patterns

The **Overall** score combines these metrics to give a holistic measure of conversational awareness.

## How It Works

The Awareness Layer automatically tracks these metrics as messages flow:

```javascript
const { lss } = require('node-lri');

// Store messages
await lss.store('session-1', lce, payload);

// Get awareness metrics
const session = await lss.getSession('session-1');
console.log('Awareness:', session.awareness);
// {
//   presence: 0.985,
//   clarity: 0.923,
//   distraction: 0.123,
//   engagement: 0.876,
//   overall: 0.894
// }
```

## Demo Scenarios

The demo shows 5 scenarios:

### 1. Focused Conversation
- Same topic, consistent timing, engaged dialogue
- **Result**: High awareness (all metrics > 0.8)

### 2. Topic Drift
- Jumping between different topics
- **Result**: High distraction (> 0.5), medium overall awareness

### 3. Intent Chaos
- Erratic intents without clear direction
- **Result**: Low clarity, high intent variance

### 4. Low Engagement
- All notifications/broadcasts, no interaction
- **Result**: Lower engagement (monologue pattern)

### 5. Recovery
- After distraction, returning to mindful conversation
- **Result**: Distraction decreases, overall awareness improves

## Run the Demo

```bash
npm install
npm run demo
```

## Example Output

```
=== LRI Awareness Layer Demo ===

Inspired by Padmasambhava's teachings on mindful presence

--- Scenario 1: Focused Conversation ---
All messages about same topic, consistent timing, engaged dialogue

Result: High Awareness ✓
  Presence:    0.985 - "here and now" quality
  Clarity:     0.923 - communication clearness
  Distraction: 0.087 - scattered attention (lower is better)
  Engagement:  0.901 - depth of involvement
  Overall:     0.894 - combined awareness


--- Scenario 2: Topic Drift ---
Jumping between different topics - losing focus

Result: Medium Awareness, High Distraction ⚠️
  Presence:    0.967 - "here and now" quality
  Clarity:     0.625 - communication clearness
  Distraction: 0.556 - scattered attention (lower is better)
  Engagement:  0.456 - depth of involvement
  Overall:     0.521 - combined awareness
```

## Integration with Interventions

Awareness metrics are automatically included in intervention callbacks:

```javascript
server.onIntervention = async (sessionId, info) => {
  console.log('Coherence:', info.coherence);
  console.log('Awareness:', info.awareness);
  // {
  //   presence: 0.765,
  //   clarity: 0.523,
  //   distraction: 0.678,  // HIGH - trigger refocus!
  //   engagement: 0.612,
  //   overall: 0.489
  // }
};
```

Interventions prioritize awareness-based detection for more compassionate guidance:
- **Distraction > 0.6** → Refocus (scattered attention)
- **Clarity < 0.5** → Clarify (unclear communication)
- **Presence < 0.5** → Summarize (losing continuity)

## Benefits

✓ **Mindful AI**: Brings Buddhist principles of awareness to AI systems
✓ **Early Detection**: Catches drift before coherence drops significantly
✓ **Compassionate**: More gentle than purely metric-based interventions
✓ **Holistic**: Considers presence, not just semantic coherence
✓ **Transparent**: Clear breakdown of awareness components

## Philosophy

The Awareness Layer is inspired by Padmasambhava's (Guru Rinpoche) teachings on rigpa - pristine awareness. In Tibetan Buddhism, rigpa refers to the natural state of awareness that's always present but often obscured by distraction, confusion, or lack of clarity.

This system applies those principles to AI conversation:
- **Presence** mirrors the quality of "being here now"
- **Clarity** reflects clear seeing without confusion
- **Distraction** detects when attention becomes scattered
- **Engagement** measures depth of involvement vs. superficial interaction

## Use Cases

- **Meditation Apps**: Track user's conversational presence
- **Therapy Bots**: Monitor session awareness quality
- **Education**: Detect when students lose focus
- **Customer Support**: Identify confused or distracted customers
- **Collaborative AI**: Maintain mindful interaction patterns

## Try It

```bash
npm install
npm run demo
```

Watch as different conversation patterns produce different awareness profiles. Notice how recovery scenarios show awareness can improve when focus returns.
