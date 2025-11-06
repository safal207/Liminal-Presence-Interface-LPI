# WebSocket with Auto-Interventions

Demonstrates automatic interventions with **Obstacle Detector** (antarāya), **Awareness Layer** (Padmasambhava-inspired), and coherence tracking - the server detects specific communication barriers and automatically intervenes with compassionate redirection.

## Features

- **Obstacle Detection**: Identifies specific impediments (vagueness, contradictions, semantic gaps, comprehension barriers)
- **Awareness Layer**: Tracks presence, clarity, distraction, and engagement (inspired by Buddhist mindfulness)
- **Coherence Tracking**: Monitors semantic alignment, intent consistency, and affect stability
- **Smart strategies**: Chooses refocus/summarize/clarify based on what component is low
- **Layered interventions**: Obstacles → Awareness → Coherence (highest to lowest priority)
- **Cooldown system**: Prevents intervention spam (configurable)
- **Context-aware**: Uses conversation history to generate relevant interventions

## How It Works

1. **Monitor**: Server tracks obstacles, awareness, and coherence after each message
2. **Detect**: When coherence < threshold (default 0.5), intervention triggered
3. **Analyze**: Examines metrics in priority order to determine best strategy:
   - **Obstacle-based (highest priority - specific barriers)**:
     - **Vagueness > 0.6** → CLARIFY (lacks specificity)
     - **Contradiction > 0.5** → CLARIFY (conflicting statements)
     - **Semantic Gap > 0.5** → REFOCUS (logical jumps)
     - **Comprehension Barrier > 0.6** → SUMMARIZE (too complex)
   - **Awareness-based (second priority - compassionate)**:
     - **Distraction > 0.6** → REFOCUS (scattered attention)
     - **Clarity < 0.5** → CLARIFY (unclear communication)
     - **Presence < 0.5** → SUMMARIZE (losing continuity)
   - **Coherence-based (fallback)**:
     - **Semantic < 0.5** → REFOCUS (topic drift)
     - **Intent < 0.4** → CLARIFY (unclear direction)
     - **Affect < 0.5** → SUMMARIZE (emotional volatility)
4. **Intervene**: Sends automatic message to guide conversation back
5. **Cooldown**: Waits before next intervention (default 30s)

## Obstacle Detector (antarāya - Buddhist concept of impediments)

Detects specific communication barriers that prevent clear understanding:

- **Vagueness** (0-1): Abstract/unclear expression lacking specifics (e.g., "thing", "stuff", "maybe")
- **Contradiction** (0-1): Conflicts with previous statements (e.g., propose then disagree on same topic)
- **Semantic Gap** (0-1): Logical jumps without connection (e.g., abrupt topic switches)
- **Comprehension Barrier** (0-1): Language complexity preventing understanding (e.g., very long messages)
- **Overall** (0-1): Combined obstacle level (higher = worse)

## Awareness Layer (Padmasambhava-Inspired)

The awareness metrics track the quality of mindful presence in conversation:

- **Presence** (0-1): "Here and now" quality - measured by consistent timing and recency
- **Clarity** (0-1): Communication clearness - based on semantic alignment and coherence
- **Distraction** (0-1): Scattered attention - topic jumping, intent chaos (lower is better)
- **Engagement** (0-1): Depth of involvement - message frequency, response patterns
- **Overall** (0-1): Combined awareness score

## Intervention Strategies

### REFOCUS
**Triggers**: Topic drift (multiple topics discussed)
**Action**: Reminds user of original topic
**Example**: "I notice we've drifted from our original discussion. Let's refocus on programming."

### CLARIFY
**Triggers**: Intent inconsistency (erratic conversation direction)
**Action**: Asks user to clarify their goal
**Example**: "Could you clarify what you're looking for? This will help me give you a better response."

### SUMMARIZE
**Triggers**: Emotional volatility (unstable affect)
**Action**: Offers to summarize what's been discussed
**Example**: "We've covered a lot of ground. Let me summarize what we've discussed so far."

## Usage

### 1. Start Server

```bash
npm install
npm run server
```

Server options:
```javascript
const server = new LRIWSServer({
  port: 9002,
  lss: true,                     // Required
  interventions: true,           // Enable interventions
  interventionThreshold: 0.5,    // Trigger when coherence < 0.5
  interventionCooldown: 30000,   // 30s between interventions
});

// Handle interventions
server.onIntervention = async (sessionId, info) => {
  console.log('Strategy:', info.suggestedStrategy);
  console.log('Reason:', info.reason);
  console.log('Awareness:', info.awareness);

  // Send custom intervention message
  await server.send(sessionId, interventionLCE, message);
};

// Access awareness metrics
const awareness = await server.getAwareness(sessionId);
const breakdown = await server.getAwarenessBreakdown(sessionId);
```

### 2. Run Client

```bash
npm run client
```

Client tests 4 scenarios:
1. Coherent conversation (no intervention)
2. Topic drift → REFOCUS intervention
3. Intent chaos → CLARIFY intervention
4. Return to coherence

## Example Output

```
[session-123] Message: "What is TypeScript?"
   Coherence: 1.000 ✓
   Awareness: 1.000 (P:1.00 C:1.00 D:0.00 E:1.00)

[session-123] Message: "I need to buy groceries"
   Coherence: 0.421 ⚠️
   Awareness: 0.612 (P:0.98 C:0.52 D:0.45 E:0.78)

🚨 INTERVENTION TRIGGERED
   Coherence: 0.421 (was 0.821)
   Strategy: refocus
   Reason: Topic drift detected
   Coherence Breakdown:
     ├─ Intent: 0.464
     ├─ Affect: 0.952
     └─ Semantic: 0.333
   Awareness Metrics (Padmasambhava-inspired):
     ├─ Presence: 0.982 (here & now quality)
     ├─ Clarity: 0.523 (communication clearness)
     ├─ Distraction: 0.452 (scattered attention)
     ├─ Engagement: 0.781 (depth of involvement)
     └─ Overall: 0.612 (combined awareness)
   → Sent: "⚠️ I notice we've drifted from programming. Let's refocus..."
```

## Configuration

```javascript
{
  interventionThreshold: 0.5,    // Lower = more interventions
  interventionCooldown: 30000,   // ms between interventions
}
```

**Threshold recommendations:**
- **0.7**: Strict - intervene at first sign of drift
- **0.5**: Balanced - intervene at clear drift (default)
- **0.3**: Relaxed - only intervene at severe drift

## Use Cases

### Chatbots
Automatically guide users back to helpful topics when they drift.

### Customer Support
Detect when customers are confused and offer clarification.

### Therapy Apps
Monitor session coherence and gently refocus when attention wanders.

### Education
Keep students focused on learning objectives.

### Collaborative AI
Maintain productive conversation flow in AI assistants.

## How to Customize

### Custom Intervention Messages

```javascript
server.onIntervention = async (sessionId, info) => {
  const history = await server.getHistory(sessionId);

  let message;
  switch (info.suggestedStrategy) {
    case 'refocus':
      message = `Let's get back to ${history[0].lce.meaning.topic}`;
      break;
    case 'summarize':
      message = 'Here's what we've covered...';
      break;
    case 'clarify':
      message = 'What exactly do you need help with?';
      break;
  }

  await server.send(sessionId, lce, message);
};
```

### Custom Strategy Logic

```javascript
// Override strategy determination
const breakdown = await server.getCoherenceBreakdown(sessionId);
const customStrategy =
  breakdown.semanticAlignment < 0.3 ? 'refocus' :
  breakdown.intentSimilarity < 0.3 ? 'clarify' :
  'summarize';
```

## Benefits

✓ **Improved UX**: Users stay on track without manual redirection
✓ **Lower confusion**: Automatic clarification when lost
✓ **Better outcomes**: Conversations reach their goals
✓ **Scalable**: Works across thousands of concurrent sessions
✓ **Transparent**: Full breakdown of why intervention triggered

## Try It

Start the server and client, then watch as interventions automatically trigger when coherence drops. The system is smart enough to wait for cooldown and choose the right strategy based on what went wrong.
