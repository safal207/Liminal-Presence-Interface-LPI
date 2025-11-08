/**
 * Padmasambhava Teacher
 *
 * An adaptive wisdom teacher that uses LRI protocol to:
 * - Understand student's emotional state through affect
 * - Track comprehension through coherence scores
 * - Select appropriate teachings based on context
 * - Respond with skillful means (upaya)
 */

import { selectTeaching, getWelcomeTeaching, getStats } from './selector.js';

/**
 * Student session tracking
 */
class StudentSession {
  constructor(sessionId, thread) {
    this.sessionId = sessionId;
    this.thread = thread;
    this.startedAt = new Date();
    this.messageCount = 0;
    this.teachingsGiven = [];
    this.coherenceHistory = [];
    this.lastAffect = null;
    this.lastIntent = null;
  }

  /**
   * Update session with new message context
   */
  updateContext(lce) {
    this.messageCount++;
    this.lastIntent = lce.intent?.type;

    if (lce.affect) {
      this.lastAffect = {
        tags: lce.affect.tags || [],
        pad: lce.affect.pad || [0, 0, 0],
      };
    }

    if (lce.qos?.coherence !== undefined) {
      this.coherenceHistory.push({
        score: lce.qos.coherence,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Get average coherence over recent messages
   */
  getAverageCoherence(window = 5) {
    if (this.coherenceHistory.length === 0) return 0.5; // neutral start

    const recent = this.coherenceHistory.slice(-window);
    const sum = recent.reduce((acc, entry) => acc + entry.score, 0);
    return sum / recent.length;
  }

  /**
   * Mark a teaching as given
   */
  recordTeaching(teachingId) {
    this.teachingsGiven.push({
      id: teachingId,
      timestamp: new Date(),
    });
  }

  /**
   * Get session summary
   */
  getSummary() {
    return {
      sessionId: this.sessionId,
      duration: Date.now() - this.startedAt.getTime(),
      messageCount: this.messageCount,
      teachingsCount: this.teachingsGiven.length,
      averageCoherence: this.getAverageCoherence(),
      lastAffect: this.lastAffect,
    };
  }
}

/**
 * Padmasambhava Teacher class
 */
export class PadmasambhavaTeacher {
  constructor() {
    this.sessions = new Map(); // sessionId -> StudentSession
    this.stats = getStats();

    console.log('[Teacher] Padmasambhava Teacher initialized');
    console.log(`[Teacher] Teaching database: ${this.stats.total} teachings loaded`);
    console.log(`  - Terma (Hidden Treasures): ${this.stats.terma}`);
    console.log(`  - Gradual Path: ${this.stats.gradual}`);
    console.log(`  - Direct Path: ${this.stats.direct}`);
  }

  /**
   * Get or create student session
   */
  getSession(sessionId, thread) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new StudentSession(sessionId, thread));
      console.log(`[Teacher] New student session: ${sessionId}`);
    }
    return this.sessions.get(sessionId);
  }

  /**
   * Process student message and generate teaching response
   * @param {string} sessionId - Session ID
   * @param {Object} lce - Incoming LCE envelope
   * @param {Buffer|string} payload - Student's message
   * @returns {Object} { lce, payload } response
   */
  teach(sessionId, lce, payload) {
    // Get or create session
    const session = this.getSession(sessionId, lce.memory?.thread);

    // Update session context
    session.updateContext(lce);

    console.log(`[Teacher] Processing message from ${sessionId}`);
    console.log(`  Intent: ${lce.intent?.type}`);
    console.log(`  Affect: ${lce.affect?.tags?.join(', ') || 'none'}`);
    console.log(`  Message: ${payload.toString().substring(0, 100)}...`);

    // Handle different intent types
    const intent = lce.intent?.type;

    // Special handling for certain intents
    if (intent === 'notify') {
      // Student is just notifying, acknowledge simply
      return this.createAcknowledgment(session, lce);
    }

    if (intent === 'sync') {
      // Student wants to check understanding
      return this.createSyncResponse(session, lce);
    }

    if (intent === 'plan') {
      // Student is planning their practice
      return this.createPlanningGuidance(session, lce, payload);
    }

    // For ask, reflect, tell, propose - provide teaching
    return this.provideTeaching(session, lce, payload);
  }

  /**
   * Provide a teaching based on context
   */
  provideTeaching(session, lce, payload) {
    // Build context for teaching selection
    const context = {
      intent: lce.intent?.type,
      affectTags: lce.affect?.tags || [],
      pad: lce.affect?.pad || [0, 0, 0],
      coherence: session.getAverageCoherence(),
      messageCount: session.messageCount,
    };

    // First message? Give welcome teaching
    const selection =
      session.messageCount === 1
        ? getWelcomeTeaching()
        : selectTeaching(context, session.teachingsGiven.map(t => t.id));

    // Record teaching
    session.recordTeaching(selection.teaching.id);

    // Build response LCE
    const responseLCE = {
      v: 1,
      intent: {
        type: 'tell',
        goal: selection.teaching.title,
      },
      policy: {
        consent: 'private', // Teachings are personal
      },
      affect: {
        tags: selection.teaching.response_style.affect_tags || ['empathetic'],
        pad: selection.teaching.response_style.pad || [0.3, 0.0, 0.2],
      },
      meaning: {
        topic: 'dharma/teaching',
        ontology: 'buddhism/vajrayana',
      },
      memory: {
        thread: lce.memory?.thread || session.thread,
        t: new Date().toISOString(),
      },
    };

    // Add metadata about teaching
    const responsePayload = {
      teaching: selection.teaching.teaching,
      metadata: {
        teaching_id: selection.teaching.id,
        teaching_title: selection.teaching.title,
        selection_score: selection.score.toFixed(2),
        is_repeat: selection.isRepeat || false,
        session_summary: session.getSummary(),
      },
    };

    console.log(`[Teacher] Responding with teaching: ${selection.teaching.id}`);
    console.log(`  Title: ${selection.teaching.title}`);
    console.log(`  Match score: ${selection.score.toFixed(2)}`);

    return {
      lce: responseLCE,
      payload: JSON.stringify(responsePayload, null, 2),
    };
  }

  /**
   * Create simple acknowledgment for notify intent
   */
  createAcknowledgment(session, lce) {
    const responseLCE = {
      v: 1,
      intent: {
        type: 'confirm',
        goal: 'Acknowledging your message',
      },
      policy: { consent: 'private' },
      affect: {
        tags: ['empathetic', 'neutral'],
        pad: [0.3, 0.0, 0.0],
      },
      memory: {
        thread: lce.memory?.thread || session.thread,
        t: new Date().toISOString(),
      },
    };

    return {
      lce: responseLCE,
      payload: 'I hear you. Continue when you are ready.',
    };
  }

  /**
   * Create sync response to check understanding
   */
  createSyncResponse(session, lce) {
    const coherence = session.getAverageCoherence();
    const summary = session.getSummary();

    let message = '';
    let affectTags = [];

    if (coherence > 0.7) {
      message = `You are progressing well on the path. Your understanding is deepening. The teachings are taking root. (Coherence: ${coherence.toFixed(2)})`;
      affectTags = ['confident', 'encouraging'];
    } else if (coherence > 0.4) {
      message = `You are finding your way. Some clarity, some confusion - this is natural. Keep practicing with patience. (Coherence: ${coherence.toFixed(2)})`;
      affectTags = ['empathetic', 'supportive'];
    } else {
      message = `The path seems unclear right now. This is normal. Let's return to the basics and rebuild understanding. (Coherence: ${coherence.toFixed(2)})`;
      affectTags = ['empathetic', 'gentle'];
    }

    const responseLCE = {
      v: 1,
      intent: {
        type: 'sync',
        goal: 'Checking understanding',
      },
      policy: { consent: 'private' },
      affect: {
        tags: affectTags,
        pad: [0.4, 0.0, 0.3],
      },
      memory: {
        thread: lce.memory?.thread || session.thread,
        t: new Date().toISOString(),
      },
      qos: {
        coherence: coherence,
      },
    };

    return {
      lce: responseLCE,
      payload: JSON.stringify({ message, summary }, null, 2),
    };
  }

  /**
   * Create planning guidance
   */
  createPlanningGuidance(session, lce, payload) {
    const message = payload.toString();

    const responseLCE = {
      v: 1,
      intent: {
        type: 'propose',
        goal: 'Offering guidance for your plan',
      },
      policy: { consent: 'private' },
      affect: {
        tags: ['supportive', 'confident'],
        pad: [0.5, 0.1, 0.4],
      },
      memory: {
        thread: lce.memory?.thread || session.thread,
        t: new Date().toISOString(),
      },
    };

    const guidance = `Your plan shows intention and commitment. Remember: consistency over intensity, gentleness over force. Start simple, be patient with yourself, and let the practice unfold naturally. I am here to guide you.`;

    return {
      lce: responseLCE,
      payload: guidance,
    };
  }

  /**
   * Close a student session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`[Teacher] Session ended: ${sessionId}`);
      console.log(`  Duration: ${Math.round(session.getSummary().duration / 1000)}s`);
      console.log(`  Messages: ${session.messageCount}`);
      console.log(`  Teachings given: ${session.teachingsGiven.length}`);
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).map(s => s.getSummary());
  }
}
