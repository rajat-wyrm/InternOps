'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Normalizes input text for AIML pattern matching:
 * - Converts to uppercase
 * - Strips punctuation (commas, periods, exclamation, question marks, quotes, etc.)
 * - Collapses repeated whitespace
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toUpperCase()
    .replace(/['"’`]/g, '')
    .replace(/[.,/#!$%^&;:{}=\-_~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips XML/HTML tags and decodes common XML entities
 */
function cleanXmlText(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

class AimlEngine {
  constructor(options = {}) {
    this.categories = [];
    this.exactMap = new Map();
    this.wildcardPatterns = [];
    this.fallbackCategory = null;
    this.maxRecursionDepth = options.maxRecursionDepth || 10;
  }

  /**
   * Loads and parses all .aiml files from a specified directory
   */
  loadDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return false;
    }

    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.aiml'))
      .map((file) => path.join(dirPath, file));

    for (const file of files) {
      this.loadFile(file);
    }

    this.indexCategories();
    return true;
  }

  /**
   * Loads and parses a single .aiml file
   */
  loadFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    this.parseAimlString(content);
  }

  /**
   * Parses raw AIML XML string and extracts categories
   */
  parseAimlString(aimlStr) {
    // Regex matching <category> ... </category>
    const categoryRegex = /<category\b[^>]*>([\s\S]*?)<\/category>/gi;
    let catMatch;

    while ((catMatch = categoryRegex.exec(aimlStr)) !== null) {
      const catBody = catMatch[1];

      const patternMatch = /<pattern\b[^>]*>([\s\S]*?)<\/pattern>/i.exec(
        catBody
      );
      const templateMatch = /<template\b[^>]*>([\s\S]*?)<\/template>/i.exec(
        catBody
      );

      if (patternMatch && templateMatch) {
        const rawPattern = patternMatch[1].trim();
        const rawTemplate = templateMatch[1].trim();
        const normalizedPattern = normalizeText(rawPattern);

        if (normalizedPattern) {
          this.categories.push({
            rawPattern,
            normalizedPattern,
            template: rawTemplate,
            hasWildcard:
              normalizedPattern.includes('*') ||
              normalizedPattern.includes('_'),
          });
        }
      }
    }
  }

  /**
   * Indexes loaded categories into exact match and ranked wildcard maps
   */
  indexCategories() {
    this.exactMap.clear();
    this.wildcardPatterns = [];
    this.fallbackCategory = null;

    for (const cat of this.categories) {
      if (cat.normalizedPattern === '*') {
        this.fallbackCategory = cat;
        continue;
      }

      if (!cat.hasWildcard) {
        this.exactMap.set(cat.normalizedPattern, cat);
      } else {
        // Compile regex for wildcard matching
        // Replace * and _ with capturing groups
        const escaped = cat.normalizedPattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '(.+?)')
          .replace(/_/g, '(.+?)');

        const regex = new RegExp(`^${escaped}$`, 'i');

        // Score pattern by word count and static tokens (higher score = more specific)
        const staticWords = cat.normalizedPattern
          .replace(/[*_]/g, '')
          .trim()
          .split(/\s+/)
          .filter(Boolean).length;
        const totalWords = cat.normalizedPattern.split(/\s+/).length;
        const priority = staticWords * 10 - (totalWords - staticWords);

        this.wildcardPatterns.push({
          ...cat,
          regex,
          priority,
        });
      }
    }

    // Sort wildcard patterns descending by specificity priority
    this.wildcardPatterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Finds the best matching category for a normalized input
   */
  findMatch(normalizedInput) {
    // 1. Direct exact match
    if (this.exactMap.has(normalizedInput)) {
      return {
        category: this.exactMap.get(normalizedInput),
        stars: [],
      };
    }

    // 2. Ranked wildcard patterns
    for (const item of this.wildcardPatterns) {
      const match = item.regex.exec(normalizedInput);
      if (match) {
        const stars = match.slice(1).map((s) => s.trim());
        return {
          category: item,
          stars,
        };
      }
    }

    // 3. Global fallback category if present
    if (this.fallbackCategory) {
      return {
        category: this.fallbackCategory,
        stars: [normalizedInput],
      };
    }

    return null;
  }

  /**
   * Evaluates and renders a template string (handling <srai>, <random>, <star>, <think>)
   */
  renderTemplate(templateStr, stars = [], depth = 0) {
    if (depth > this.maxRecursionDepth) {
      return cleanXmlText(templateStr);
    }

    let result = templateStr;

    // Remove <think> blocks
    result = result.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');

    // Handle <random><li>...</li></random> blocks
    result = result.replace(
      /<random\b[^>]*>([\s\S]*?)<\/random>/gi,
      (match, body) => {
        const items = [];
        const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch;
        while ((liMatch = liRegex.exec(body)) !== null) {
          items.push(liMatch[1].trim());
        }
        if (items.length === 0) return '';
        const selected = items[Math.floor(Math.random() * items.length)];
        return selected;
      }
    );

    // Handle <star index="N"/> and <star/>
    result = result.replace(
      /<star(?:\s+index=["']?(\d+)["']?)?\s*\/?>/gi,
      (match, indexStr) => {
        const index = indexStr ? parseInt(indexStr, 10) - 1 : 0;
        return stars[index] || '';
      }
    );

    // Handle <srai>...</srai> redirects
    const sraiRegex = /<srai\b[^>]*>([\s\S]*?)<\/srai>/gi;
    let sraiMatch;
    let hasSrai = false;

    // Replace all <srai> queries with their evaluated response
    while ((sraiMatch = sraiRegex.exec(result)) !== null) {
      hasSrai = true;
      const targetQuery = sraiMatch[1].trim();
      const sraiRes = this.process(targetQuery, depth + 1);
      return sraiRes.response;
    }

    if (!hasSrai) {
      result = cleanXmlText(result);
    }

    return result.replace(/\s+/g, ' ').trim();
  }

  /**
   * Main query processor
   */
  process(rawInput, depth = 0) {
    const normalized = normalizeText(rawInput);

    if (!normalized) {
      return {
        matched: false,
        response:
          'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.',
        isFallback: true,
      };
    }

    const matchResult = this.findMatch(normalized);

    if (!matchResult) {
      return {
        matched: false,
        response:
          'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.',
        isFallback: true,
      };
    }

    const { category, stars } = matchResult;
    const isFallback = category === this.fallbackCategory;
    const response = this.renderTemplate(category.template, stars, depth);

    return {
      matched: !isFallback,
      response,
      isFallback,
      pattern: category.rawPattern,
    };
  }
}

module.exports = {
  AimlEngine,
  normalizeText,
};
