'use strict';

const path = require('path');
const {
  AimlEngine,
  normalizeText,
} = require('../../src/modules/chatbot/aimlEngine');
const chatbotService = require('../../src/modules/chatbot/service');

describe('AIML Engine & Chatbot Unit Tests', () => {
  let engine;

  beforeAll(() => {
    engine = new AimlEngine();
    const aimlDir = path.resolve(__dirname, '../../knowledge_base/aiml');
    const loaded = engine.loadDirectory(aimlDir);
    expect(loaded).toBe(true);
  });

  describe('Text Normalization', () => {
    it('normalizes uppercase, punctuation, and multiple spaces', () => {
      expect(normalizeText('  How do I start, my internship?!  ')).toBe(
        'HOW DO I START MY INTERNSHIP'
      );
      expect(normalizeText("Where's my task???")).toBe('WHERES MY TASK');
    });
  });

  describe('Onboarding Intent Matching', () => {
    it('matches "How do I start my internship?" with onboarding response', () => {
      const result = engine.process('How do I start my internship?');
      expect(result.matched).toBe(true);
      expect(result.isFallback).toBe(false);
      expect(result.response).toMatch(
        /start your internship|internops|onboarding/i
      );
    });

    it('matches "What should I do after joining?"', () => {
      const result = engine.process('What should I do after joining?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(
        /onboarding documents|checklist|orientation/i
      );
    });

    it('matches "What documents are required?"', () => {
      const result = engine.process('What documents are required?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/ID|Aadhaar|Bonafide|NDA|offer letter/i);
    });

    it('matches "Where can I find onboarding instructions?"', () => {
      const result = engine.process(
        'Where can I find onboarding instructions?'
      );
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/onboarding section|sidebar|email/i);
    });

    it('matches "How do I complete my onboarding?"', () => {
      const result = engine.process('How do I complete my onboarding?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/checklist/i);
    });
  });

  describe('Workflow & Query Variations Matching', () => {
    it('resolves multiple query variations to the same workflow intent via SRAI', () => {
      const queries = [
        'How do I submit my work?',
        'How can I submit my work?',
        'Where do I submit my assignment?',
        'How can I submit my task?',
        'Where can I upload my work?',
        'How to upload proof',
      ];

      for (const query of queries) {
        const result = engine.process(query);
        expect(result.matched).toBe(true);
        expect(result.isFallback).toBe(false);
        expect(result.response).toMatch(/tasks|upload proof|submit/i);
      }
    });

    it('matches "How do I update my task status?"', () => {
      const result = engine.process('How do I update my task status?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/tasks|status/i);
    });

    it('matches "How do I contact my mentor?"', () => {
      const result = engine.process('How do I contact my mentor?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/team|email|slack|meetings/i);
    });

    it('matches "Where can I see my assigned tasks?"', () => {
      const result = engine.process('Where can I see my assigned tasks?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/tasks|sidebar|dashboard/i);
    });

    it('matches "How do I submit a project?"', () => {
      const result = engine.process('How do I submit a project?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/repository|github|readme/i);
    });
  });

  describe('Company Policies Matching', () => {
    it('matches "What is the attendance policy?"', () => {
      const result = engine.process('What is the attendance policy?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/attendance|80%/i);
    });

    it('matches "What are the working hours?"', () => {
      const result = engine.process('What are the working hours?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/9:30 AM|6:30 PM|Monday through Friday/i);
    });

    it('matches "What is the leave policy?"', () => {
      const result = engine.process('What is the leave policy?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/leave|request|sick/i);
    });

    it('matches "What are the workplace rules?"', () => {
      const result = engine.process('What are the workplace rules?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(
        /code of conduct|professionalism|confidential/i
      );
    });
  });

  describe('InternOps Platform Usage Matching', () => {
    it('matches "How do I use the InternOps dashboard?"', () => {
      const result = engine.process('How do I use the InternOps dashboard?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/dashboard|tasks|attendance/i);
    });

    it('matches "How do I update my profile?"', () => {
      const result = engine.process('How do I update my profile?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/profile|password|avatar/i);
    });

    it('matches "How do I check my internship status?"', () => {
      const result = engine.process('How do I check my internship status?');
      expect(result.matched).toBe(true);
      expect(result.response).toMatch(/status|profile|certificate/i);
    });
  });

  describe('Safe Fallback & Unknown Queries', () => {
    it('returns safe fallback for unknown queries like "Tell me about quantum computing."', () => {
      const result = engine.process('Tell me about quantum computing.');
      expect(result.isFallback).toBe(true);
      expect(result.response).toBe(
        'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.'
      );
    });

    it('returns safe fallback for empty input', () => {
      const result = engine.process('');
      expect(result.isFallback).toBe(true);
      expect(result.response).toBe(
        'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.'
      );
    });
  });

  describe('ChatbotService Fallback Hierarchy', () => {
    it('returns source: "aiml" for recognized AIML questions', async () => {
      const res = await chatbotService.processMessage(
        'How do I submit my work?'
      );
      expect(res.source).toBe('aiml');
      expect(res.response).toMatch(/tasks|submit/i);
    });

    it('returns source: "fallback" for unmatched queries', async () => {
      const res = await chatbotService.processMessage(
        'Explain the theory of relativity in astrophysics'
      );
      expect(res.source).toBe('fallback');
      expect(res.response).toBe(
        'I’m not sure about that yet. Please try rephrasing your question or contact your mentor/support team.'
      );
    });

    it('returns source: "fallback" for empty message input', async () => {
      const res = await chatbotService.processMessage('');
      expect(res.source).toBe('fallback');
    });
  });

  describe('Performance Benchmark', () => {
    it('processes an AIML query in well under 100ms (sub-second target)', async () => {
      const start = Date.now();
      const res = await chatbotService.processMessage(
        'How do I start my internship?'
      );
      const duration = Date.now() - start;

      expect(res.source).toBe('aiml');
      expect(duration).toBeLessThan(100);
    });
  });
});
