# WebSocket with Auto-Interventions

Demonstrates automatic coherence-based interventions - the server detects when conversation coherence drops and automatically intervenes to refocus the conversation.

## Features

- **Automatic detection**: Server monitors coherence after each message
- **Smart strategies**: Chooses refocus/summarize/clarify based on what component is low
- **Cooldown system**: Prevents intervention spam (configurable)
- **Context-aware**: Uses conversation history to generate relevant interventions

## How It Works

1. **Monitor**: Server tracks coherence after each message
2. **Detect**: When coherence < threshold (default 0.5), intervention triggered
3. **Analyze**: Examines breakdown to determine best strategy:
   - **Semantic < 0.5** → REFOCUS (topic drift)
   - **Intent < 0.4** → CLARIFY (unclear direction)
   - **Affect < 0.5** → SUMMARIZE (emotional volatility)
4. **Intervene**: Sends automatic message to guide conversation back
5. **Cooldown**: Waits before next intervention (default 30s)

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

  // Send custom intervention message
  await server.send(sessionId, interventionLCE, message);
};
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

[session-123] Message: "I need to buy groceries"
   Coherence: 0.421 ⚠️

🚨 INTERVENTION TRIGGERED
   Coherence: 0.421 (was 0.821)
   Strategy: refocus
   Reason: Topic drift detected
   Breakdown:
     ├─ Intent: 0.464
     ├─ Affect: 0.952
     └─ Semantic: 0.333
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
