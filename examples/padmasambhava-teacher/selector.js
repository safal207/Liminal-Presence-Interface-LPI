/**
 * Teaching Selector
 *
 * Intelligently selects appropriate teachings based on:
 * - Student's emotional state (affect tags)
 * - Communicative intent
 * - Coherence score (understanding level)
 * - Previous teachings given
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load teaching databases
const terma = JSON.parse(readFileSync(join(__dirname, 'teachings/terma.json'), 'utf-8'));
const gradual = JSON.parse(readFileSync(join(__dirname, 'teachings/gradual.json'), 'utf-8'));
const direct = JSON.parse(readFileSync(join(__dirname, 'teachings/direct.json'), 'utf-8'));

const ALL_TEACHINGS = [
  ...terma.teachings,
  ...gradual.teachings,
  ...direct.teachings,
];

/**
 * Calculate match score between student context and teaching context
 * @param {Object} studentContext - Current student state
 * @param {Object} teachingContext - Teaching's context requirements
 * @returns {number} Score 0-1
 */
function calculateMatchScore(studentContext, teachingContext) {
  let score = 0;
  let factors = 0;

  // Match affect tags
  if (studentContext.affectTags && teachingContext.student_state) {
    const matchingTags = studentContext.affectTags.filter(tag =>
      teachingContext.student_state.includes(tag)
    );
    score += (matchingTags.length / teachingContext.student_state.length) * 0.4;
    factors += 0.4;
  }

  // Match intent
  if (studentContext.intent && teachingContext.intent_match) {
    if (teachingContext.intent_match.includes(studentContext.intent)) {
      score += 0.3;
    }
    factors += 0.3;
  }

  // Match depth based on coherence
  if (studentContext.coherence !== undefined && teachingContext.depth) {
    const depthScore = matchDepth(studentContext.coherence, teachingContext.depth);
    score += depthScore * 0.3;
    factors += 0.3;
  }

  return factors > 0 ? score / factors : 0;
}

/**
 * Match teaching depth to student's comprehension level (coherence)
 * @param {number} coherence - 0-1, higher = better understanding
 * @param {string} depth - 'shallow', 'medium', 'deep'
 * @returns {number} Score 0-1
 */
function matchDepth(coherence, depth) {
  // High coherence (>0.7) → can handle deep teachings
  // Medium coherence (0.4-0.7) → medium teachings
  // Low coherence (<0.4) → need shallow teachings

  if (depth === 'shallow') {
    return coherence < 0.5 ? 1.0 : 0.5;
  } else if (depth === 'medium') {
    return coherence >= 0.4 && coherence <= 0.7 ? 1.0 : 0.6;
  } else if (depth === 'deep') {
    return coherence > 0.7 ? 1.0 : coherence > 0.5 ? 0.7 : 0.3;
  }

  return 0.5;
}

/**
 * Calculate semantic similarity between PAD vectors
 * Uses cosine similarity
 * @param {Array} pad1 - [pleasure, arousal, dominance]
 * @param {Array} pad2 - [pleasure, arousal, dominance]
 * @returns {number} Similarity 0-1
 */
function padSimilarity(pad1, pad2) {
  if (!pad1 || !pad2) return 0.5; // neutral if missing

  const dotProduct = pad1[0] * pad2[0] + pad1[1] * pad2[1] + pad1[2] * pad2[2];
  const mag1 = Math.sqrt(pad1[0] ** 2 + pad1[1] ** 2 + pad1[2] ** 2);
  const mag2 = Math.sqrt(pad2[0] ** 2 + pad2[1] ** 2 + pad2[2] ** 2);

  if (mag1 === 0 || mag2 === 0) return 0.5;

  // Convert from [-1, 1] to [0, 1]
  return (dotProduct / (mag1 * mag2) + 1) / 2;
}

/**
 * Select best teaching for current context
 * @param {Object} context - Student context
 * @param {Array} previousTeachings - IDs of already given teachings
 * @returns {Object} Selected teaching with metadata
 */
export function selectTeaching(context, previousTeachings = []) {
  // Filter out already given teachings (unless all have been given)
  let availableTeachings = ALL_TEACHINGS.filter(t =>
    !previousTeachings.includes(t.id)
  );

  // If all teachings given, reset but mark as repeat
  if (availableTeachings.length === 0) {
    availableTeachings = ALL_TEACHINGS;
    context.isRepeat = true;
  }

  // Score each teaching
  const scored = availableTeachings.map(teaching => {
    const matchScore = calculateMatchScore(context, teaching.context);

    // Bonus for PAD alignment between student and teaching response
    let padBonus = 0;
    if (context.pad && teaching.response_style?.pad) {
      padBonus = padSimilarity(context.pad, teaching.response_style.pad) * 0.2;
    }

    return {
      teaching,
      score: matchScore + padBonus,
    };
  });

  // Sort by score and pick best
  scored.sort((a, b) => b.score - a.score);

  const selected = scored[0];

  console.log(`[Selector] Selected teaching: ${selected.teaching.id} (score: ${selected.score.toFixed(2)})`);

  return {
    teaching: selected.teaching,
    score: selected.score,
    isRepeat: context.isRepeat || false,
  };
}

/**
 * Get a random welcoming teaching for new students
 * @returns {Object} Welcome teaching
 */
export function getWelcomeTeaching() {
  const welcomeTeachings = gradual.teachings.filter(t => t.context.depth === 'shallow');
  const random = welcomeTeachings[Math.floor(Math.random() * welcomeTeachings.length)];

  return {
    teaching: random,
    score: 1.0,
    isWelcome: true,
  };
}

/**
 * Get teaching by ID (for testing)
 * @param {string} id - Teaching ID
 * @returns {Object|null} Teaching or null
 */
export function getTeachingById(id) {
  return ALL_TEACHINGS.find(t => t.id === id) || null;
}

/**
 * Get statistics about teaching database
 * @returns {Object} Stats
 */
export function getStats() {
  return {
    total: ALL_TEACHINGS.length,
    terma: terma.teachings.length,
    gradual: gradual.teachings.length,
    direct: direct.teachings.length,
    depths: {
      shallow: ALL_TEACHINGS.filter(t => t.context.depth === 'shallow').length,
      medium: ALL_TEACHINGS.filter(t => t.context.depth === 'medium').length,
      deep: ALL_TEACHINGS.filter(t => t.context.depth === 'deep').length,
    },
  };
}
