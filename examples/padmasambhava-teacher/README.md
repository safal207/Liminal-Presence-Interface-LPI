# 🪷 Padmasambhava Teacher - The Vajra Path

An adaptive wisdom teacher powered by the LRI (Liminal Resonance Interface) protocol. Inspired by Padmasambhava, the 8th-century Buddhist master known for his skillful means (*upaya*) in adapting teachings to each student's capacity.

> *"The mind is like the sky - thoughts are like clouds passing through. Do not grasp the clouds, rest in the vast openness of sky-like awareness."*

## 🎯 What is This?

The Padmasambhava Teacher is a **WebSocket-based teaching system** that:

1. **Understands your emotional state** through LRI's affect tags
2. **Tracks your comprehension** using LSS (Liminal Session Store) coherence scoring
3. **Selects appropriate teachings** based on your context and readiness
4. **Adapts its teaching style** using the principle of skillful means

This is a demonstration of how LRI's semantic protocol enables **context-aware, emotionally intelligent communication** between humans and AI.

## 🏗️ Architecture

```
┌─────────────────┐
│  Student Client │
│  (client.js)    │
└────────┬────────┘
         │ WebSocket + LRI Protocol
         │
┌────────▼────────────────────────────┐
│  LRI WebSocket Server               │
│  - LHS Handshake                    │
│  - LSS Coherence Tracking           │
└────────┬────────────────────────────┘
         │
┌────────▼────────────────────────────┐
│  Padmasambhava Teacher              │
│  - Session Management               │
│  - Context Analysis                 │
└────────┬────────────────────────────┘
         │
┌────────▼────────────────────────────┐
│  Teaching Selector                  │
│  - Match scoring                    │
│  - PAD similarity                   │
│  - Depth matching                   │
└────────┬────────────────────────────┘
         │
┌────────▼────────────────────────────┐
│  Teachings Database                 │
│  - Terma (Hidden Treasures)         │
│  - Gradual Path                     │
│  - Direct Path                      │
└─────────────────────────────────────┘
```

## 📚 Teaching Categories

### 1. **Terma (Hidden Treasures)** - Advanced
Secret teachings revealed when the student is ready:
- The Nature of Mind
- Recognizing Empty Luminosity
- The Vajra Body
- Transforming Obstacles
- The Essence of Guru Yoga

### 2. **Gradual Path** - Beginner to Intermediate
Step-by-step instructions for practice:
- Beginning with the Breath
- Establishing Daily Practice
- Working with Thoughts
- Cultivating Loving-Kindness
- Observing Impermanence
- Integrating Practice into Life

### 3. **Direct Path** - Advanced
Immediate pointing-out instructions:
- Look at the Looker
- The Thought-Free Wakefulness
- Self-Liberating Awareness
- The Ever-Present Now
- Non-Dual Seeing
- The Pathless Path

## 🚀 Quick Start

### Installation

```bash
# From the examples/padmasambhava-teacher directory
npm install
```

### Running the Server

```bash
npm run server
```

You should see:

```
═══════════════════════════════════════════════════════
🪷  Padmasambhava Teacher - The Vajra Path  🪷
═══════════════════════════════════════════════════════

Cutting through confusion with diamond clarity.

WebSocket server listening on port 8888
Waiting for students to connect...
```

### Running the Client

In another terminal:

```bash
npm run client
```

You'll be connected and can start asking questions!

## 💬 How to Use the Client

### Basic Usage

Just type your question naturally:

```
🙏 You: How do I start meditating?
```

The teacher will respond with an appropriate teaching based on your state.

### Commands

- **`help`** - Show available commands
- **`exit`** - Disconnect and quit
- **`sync`** - Check your current understanding level (coherence)
- **`plan <text>`** - Share your practice plan
- **`reflect <text>`** - Share a reflection or insight

### Affect Modifiers

Express your emotional state to get more appropriate teachings:

- **`/curious`** - Default state, open to learning
- **`/frustrated`** - Struggling with practice
- **`/confused`** - Need clarity
- **`/peaceful`** - Calm and receptive

Example:

```
🙏 You: /frustrated
🙏 You: I can't stop my thoughts during meditation!
```

The teacher will respond with compassionate, practical guidance suited to your frustration.

## 🧠 How It Works

### 1. Intent Signaling

Every message has an **intent** that clarifies your communicative goal:

- `ask` → Request teaching or guidance
- `reflect` → Share insight or contemplation
- `sync` → Check understanding
- `plan` → Outline practice intentions
- `tell` → Share information

### 2. Affect Tags

Your **emotional state** is conveyed through tags:

- `curious` - Open to learning
- `frustrated` - Experiencing difficulty
- `confused` - Need clarity
- `peaceful` - Calm and receptive
- `analytical` - Focused on understanding

### 3. PAD Model

Emotions are represented in 3D space:

- **P**leasure: -1 (unpleasant) to +1 (pleasant)
- **A**rousal: -1 (calm) to +1 (alert)
- **D**ominance: -1 (controlled) to +1 (in control)

Example: `curious = [0.3, 0.2, 0.1]` (slightly pleasant, slightly alert, slightly in control)

### 4. Coherence Tracking

The system calculates **coherence scores** (0-1) based on:

- Intent consistency
- Affect stability
- Semantic alignment

Higher coherence → Teacher offers deeper teachings
Lower coherence → Teacher returns to basics

### 5. Teaching Selection

The selector scores each teaching based on:

1. **Affect Match** (40%) - Do your emotional tags match the teaching's context?
2. **Intent Match** (30%) - Does your intent align with the teaching type?
3. **Depth Match** (30%) - Does your coherence level match the teaching depth?
4. **PAD Similarity** (bonus) - How similar is your emotional state to the teaching's response style?

## 📊 Example Session

```
Student: "How do I start meditating?"
└─ Intent: ask
└─ Affect: curious [0.3, 0.2, 0.1]
└─ Coherence: 0.5 (first message)

Teacher selects: "Beginning with the Breath" (gradual_001)
└─ Match score: 0.85
└─ Depth: shallow
└─ Response affect: empathetic, casual

Teacher: "Start simple: follow your breath. Breathe in, know you breathe in.
          Breathe out, know you breathe out. This is the foundation..."

Student: "I tried but my mind keeps wandering!"
└─ Intent: reflect
└─ Affect: frustrated [-0.4, 0.3, -0.2]
└─ Coherence: 0.6 (understanding is progressing)

Teacher selects: "Working with Thoughts" (gradual_003)
└─ Match score: 0.92
└─ Depth: medium
└─ Response affect: empathetic, encouraging

Teacher: "When thoughts arise during meditation, don't fight them. Label them
          gently: 'thinking'. Then return to your breath. Each time you notice
          and return, you strengthen awareness..."
```

## 🔧 Technical Details

### LCE Structure

Every message is wrapped in an **LCE (Liminal Context Envelope)**:

```json
{
  "v": 1,
  "intent": {
    "type": "ask",
    "goal": "How to meditate?"
  },
  "policy": {
    "consent": "private"
  },
  "affect": {
    "tags": ["curious"],
    "pad": [0.3, 0.2, 0.1]
  },
  "memory": {
    "thread": "session-uuid",
    "t": "2025-01-15T10:30:00Z"
  },
  "qos": {
    "coherence": 0.75
  }
}
```

### LHS Handshake

Connection establishment follows the **Liminal Handshake Sequence**:

1. **Hello** → Client announces capabilities
2. **Mirror** → Server reflects agreed capabilities
3. **Bind** → Client binds to thread
4. **Seal** → Server seals the session
5. **Flow** → Normal message exchange begins

### Session Tracking

Each student session tracks:

- Message count
- Teachings given (IDs)
- Coherence history
- Last affect state
- Session duration

## 🎨 Customization

### Adding New Teachings

Edit the JSON files in `teachings/`:

```json
{
  "id": "custom_001",
  "title": "Your Teaching Title",
  "teaching": "Your wisdom here...",
  "context": {
    "student_state": ["curious", "open"],
    "intent_match": ["ask", "reflect"],
    "depth": "medium"
  },
  "response_style": {
    "affect_tags": ["empathetic", "confident"],
    "pad": [0.4, 0.0, 0.3]
  }
}
```

### Adjusting Selection Algorithm

Modify `selector.js` to change how teachings are scored:

```javascript
// Current weights
score = 0.4 * affectMatch
      + 0.3 * intentMatch
      + 0.3 * depthMatch
      + 0.2 * padSimilarity
```

### Custom Teacher Personality

Edit `teacher.js` response functions to change the teacher's voice and style.

## 🧘 Philosophy

This project embodies several key Buddhist concepts:

1. **Upaya (Skillful Means)** - Adapting teaching to the student's capacity
2. **Lam Rim (Gradual Path)** - Progressive stages of understanding
3. **Dzogchen (Great Perfection)** - Direct pointing-out instructions
4. **Terma (Hidden Treasures)** - Teachings revealed when ready
5. **Vajra (Diamond/Thunderbolt)** - Indestructible clarity cutting through confusion

## 🙏 Credits

Inspired by:
- **Padmasambhava** (Guru Rinpoche) - 8th century Buddhist master
- **The Tibetan Book of the Dead** (Bardo Thodol)
- **Dzogchen teachings** - The Great Perfection tradition
- **LRI Protocol** - Liminal Resonance Interface for semantic communication

## 📜 License

Part of the LRI project. See main project LICENSE.

---

*May all beings be happy. May all beings be free.*

🪷 ༀ मणि पद्मे हूँ 🪷
