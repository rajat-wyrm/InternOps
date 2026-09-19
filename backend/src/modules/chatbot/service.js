'use strict';

const path = require('path');
const fs = require('fs');
const { AimlEngine, normalizeText } = require('./aimlEngine');
const repository = require('./repository');

const SAFE_FALLBACK_TEXT =
  'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.';

class ChatbotService {
  constructor() {
    this.engine = new AimlEngine();
    this.initialized = false;
    this.init();
  }

  init() {
    const possiblePaths = [
      path.resolve(__dirname, '../../../../knowledge_base/aiml'),
      path.resolve(__dirname, '../../../knowledge_base/aiml'),
      path.resolve(process.cwd(), 'knowledge_base/aiml'),
      path.resolve(process.cwd(), '../knowledge_base/aiml'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.engine.loadDirectory(p);
        this.initialized = true;
        break;
      }
    }
  }

  /**
   * Processes a user message through the 3-tier fallback hierarchy:
   * 1. AIML exact/pattern-based match -> source: 'aiml'
   * 2. Knowledge-base / database policies -> source: 'knowledge_base'
   * 3. Safe fallback response -> source: 'fallback'
   */
  async processMessage(message, options = {}) {
    const rawMessage = String(message || '').trim();
    const userId = options.userId || null;
    const canViewSensitive = options.canViewSensitive || false;

    if (!rawMessage) {
      return {
        response: SAFE_FALLBACK_TEXT,
        source: 'fallback',
      };
    }

    // Tier 1: AIML Engine matching
    const aimlResult = this.engine.process(rawMessage);

    if (aimlResult.matched && !aimlResult.isFallback) {
      return {
        response: aimlResult.response,
        source: 'aiml',
      };
    }

    // Tier 2: Dynamic Knowledge Base / Policies matching
    const normalized = normalizeText(rawMessage);
    const keywords = normalized.split(/\s+/).filter((word) => word.length > 3);

    if (keywords.length > 0) {
      const relevantPolicies = await repository.searchPolicies(
        keywords,
        canViewSensitive
      );
      if (relevantPolicies && relevantPolicies.length > 0) {
        const topPolicy = relevantPolicies[0];
        const answer = `**${topPolicy.title}**\n\n${topPolicy.content}`;

        if (userId) {
          await repository.logInteraction(
            userId,
            rawMessage,
            [topPolicy.id],
            false
          );
        }

        return {
          response: answer,
          source: 'knowledge_base',
        };
      }
    }

    // Tier 3: Safe fallback response
    return {
      response: SAFE_FALLBACK_TEXT,
      source: 'fallback',
    };
  }
}

const instance = new ChatbotService();

module.exports = instance;
