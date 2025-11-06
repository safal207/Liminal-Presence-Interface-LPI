# Obstacle Detector Demo

Demonstrates the **Obstacle Detector** - a system inspired by the Buddhist concept of **antarāya** (impediments) that detects specific communication barriers preventing clear understanding.

## What are Obstacles (antarāya)?

In Buddhist philosophy, antarāya refers to obstacles or impediments that block clear perception and understanding. This system applies that concept to AI communication, detecting four types of barriers:

1. **Vagueness** - Abstract/unclear expression lacking specifics
2. **Contradiction** - Conflicting statements within conversation
3. **Semantic Gap** - Logical jumps without connection
4. **Comprehension Barrier** - Language complexity preventing understanding

## How It Works

The Obstacle Detector analyzes message patterns to identify specific communication problems:

```javascript
const { lss: lssModule } = require('node-lri');
const lss = new lssModule.LSS();

// Store messages
await lss.store('session-1', lce, payload);

// Get obstacle metrics
const session = await lss.getSession('session-1');
console.log('Obstacles:', session.obstacles);
// {
//   vagueness: 0.678,
//   contradiction: 0.234,
//   semanticGap: 0.456,
//   comprehensionBarrier: 0.123,
//   overall: 0.373
// }
```

## Demo Scenarios

The demo shows 5 scenarios:

### 1. Vague Communication
- Uses abstract words: "thing", "stuff", "maybe", "whatever"
- Generic topics
- Lacks concrete details
- **Result**: High vagueness score (>0.6)

### 2. Contradictions
- Proposes then disagrees on same topic
- Affirms then denies
- Strong emotional polarity flips
- **Result**: High contradiction score (>0.4)

### 3. Semantic Gaps
- Abrupt topic changes (quantum physics → cooking → car repair)
- No logical connection between topics
- Questions left unanswered
- **Result**: High semantic gap score (>0.5)

### 4. Comprehension Barriers
- Very long messages (>100 words)
- Deeply nested data structures (>4 levels)
- Complex technical jargon
- **Result**: High comprehension barrier (>0.3)

### 5. Clear Communication
- Specific, concrete language
- Consistent topic
- Logical flow
- **Result**: Minimal obstacles (<0.2 overall)

## Run the Demo

```bash
npm install
npm run demo
```

## Example Output

```
=== LRI Obstacle Detector Demo ===

Inspired by Buddhist concept of antarāya (impediments)

--- Scenario 1: Vague Communication ---
Messages with unclear, abstract language

Result: High Vagueness Detected ⚠️
  Vagueness:             0.784 - unclear expression (higher = worse)
  Contradiction:         0.000 - conflicting statements
  Semantic Gap:          0.000 - logical jumps
  Comprehension Barrier: 0.000 - complexity
  Overall:               0.196 - combined obstacles


--- Scenario 2: Contradictions ---
Conflicting statements on same topics

Result: Contradictions Detected ⚠️
  Vagueness:             0.000 - unclear expression (higher = worse)
  Contradiction:         0.667 - conflicting statements
  Semantic Gap:          0.500 - logical jumps
  Comprehension Barrier: 0.000 - complexity
  Overall:               0.292 - combined obstacles
```

## Integration with Interventions

Obstacle metrics are automatically included in intervention callbacks and prioritized:

```javascript
server.onIntervention = async (sessionId, info) => {
  console.log('Obstacles:', info.obstacles);

  // Intervention strategies based on obstacles:
  // - Vagueness > 0.6 → Ask for specifics
  // - Contradiction > 0.5 → Point out conflict
  // - Semantic Gap > 0.5 → Request logical connection
  // - Comprehension Barrier > 0.6 → Simplify/summarize
};
```

**Priority Order** (highest to lowest):
1. **Obstacles** - specific, actionable barriers
2. **Awareness** - compassionate presence tracking
3. **Coherence** - general semantic alignment

## Detection Methods

### Vagueness
- Scans for vague words: "thing", "stuff", "maybe", "perhaps", "kind of", "sort of"
- Checks for missing/generic topics
- Weights: 3+ vague words = maximum score

### Contradiction
- Detects opposing intents on same topic (propose → disagree)
- Identifies affect polarity flips (pleasure -0.7 → +0.8)
- Weights: Multiple contradictions compound

### Semantic Gap
- Compares topics for common words
- Checks for unanswered questions (ask → plan without tell)
- Weights: No common words = gap detected

### Comprehension Barrier
- Counts words in messages (>100 = complex)
- Measures data structure depth (>4 levels = complex)
- Weights: Scales with complexity

## Benefits

✓ **Specific Detection**: Identifies exact type of communication problem
✓ **Actionable**: Each obstacle type suggests specific intervention
✓ **Buddhist Wisdom**: Applies contemplative insights to AI
✓ **Complementary**: Works alongside awareness and coherence
✓ **Real-time**: Updates with each message

## Philosophy

The Obstacle Detector embodies the Buddhist understanding that clear communication requires removing impediments (antarāya). In meditation practice, practitioners learn to identify and remove obstacles to clarity:

- **Vagueness** mirrors mental fogginess
- **Contradiction** reflects conflicting intentions
- **Semantic gaps** represent broken continuity of thought
- **Comprehension barriers** parallel overwhelming complexity

By detecting these obstacles in AI conversation, we create systems that guide towards clarity with compassion.

## Use Cases

- **Chatbots**: Detect when users are being vague and ask clarifying questions
- **Education**: Identify when students are confused or contradicting themselves
- **Therapy Apps**: Notice communication barriers and address them gently
- **Customer Support**: Detect complexity overload and simplify responses
- **Collaborative AI**: Maintain clear, connected dialogue

## Try It

```bash
npm install
npm run demo
```

Watch as different communication patterns produce different obstacle profiles. Notice how clear, specific communication produces minimal obstacles.
