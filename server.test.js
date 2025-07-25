const request = require('supertest');
const { app } = require('./server');
const { PromotionEngine } = require('./main');

describe('PromotionRuleEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PromotionEngine();
    // Reset metrics for each test
    engine.metrics = {
      totalEvaluations: 0,
      hits: 0,
      misses: 0,
      totalLatency: 0,
      lastReload: null,
    };
  });

  describe('Rule Evaluation', () => {
    test('should evaluate simple equality condition', () => {
      const condition = { field: 'level', operator: 'eq', value: 10 };
      const playerData = { level: 10 };

      expect(engine.evaluateCondition(condition, playerData)).toBe(true);
    });

    test('should evaluate greater than condition', () => {
      const condition = { field: 'level', operator: 'gt', value: 5 };
      const playerData = { level: 10 };

      expect(engine.evaluateCondition(condition, playerData)).toBe(true);
    });

    test('should evaluate in-array condition', () => {
      const condition = {
        field: 'country',
        operator: 'in',
        value: ['US', 'UK', 'CA'],
      };
      const playerData = { country: 'US' };

      expect(engine.evaluateCondition(condition, playerData)).toBe(true);
    });

    test('should handle missing player data', () => {
      const condition = { field: 'level', operator: 'eq', value: 10 };
      const playerData = { name: 'John' };

      expect(engine.evaluateCondition(condition, playerData)).toBe(false);
    });

    test('should handle nested field access', () => {
      const condition = {
        field: 'profile.tier',
        operator: 'eq',
        value: 'gold',
      };
      const playerData = { profile: { tier: 'gold' } };

      expect(engine.evaluateCondition(condition, playerData)).toBe(true);
    });
  });

  describe('Rule Logic', () => {
    test('should evaluate AND logic correctly', () => {
      const rule = {
        logic: 'AND',
        conditions: [
          { field: 'level', operator: 'gte', value: 10 },
          { field: 'country', operator: 'eq', value: 'US' },
        ],
      };
      const playerData = { level: 15, country: 'US' };

      expect(engine.evaluateRule(rule, playerData)).toBe(true);
    });

    test('should evaluate OR logic correctly', () => {
      const rule = {
        logic: 'OR',
        conditions: [
          { field: 'level', operator: 'eq', value: 20 },
          { field: 'level', operator: 'eq', value: 30 },
        ],
      };
      const playerData = { level: 20 };

      expect(engine.evaluateRule(rule, playerData)).toBe(true);
    });

    test('should handle AND logic with one false condition', () => {
      const rule = {
        logic: 'AND',
        conditions: [
          { field: 'level', operator: 'gte', value: 10 },
          { field: 'country', operator: 'eq', value: 'UK' },
        ],
      };
      const playerData = { level: 15, country: 'US' };

      expect(engine.evaluateRule(rule, playerData)).toBe(false);
    });
  });

  describe('Promotion Selection', () => {
    test('should select promotion for valid player', () => {
      const playerData = {
        playerId: 'player123',
        level: 1,
        daysSinceRegistration: 1,
        totalSpent: 0,
        country: 'US',
      };

      const promotion = engine.selectPromotion(playerData);
      expect(promotion).not.toBeNull();
      expect(promotion.type).toBeDefined();
    });

    test('should return null for invalid player data', () => {
      const playerData = {}; // Missing required playerId

      const promotion = engine.selectPromotion(playerData);
      expect(promotion).toBeNull();
    });

    test('should select highest priority rule when multiple match', () => {
      // Mock rules for this test
      engine.rules = [
        {
          id: 'low_priority',
          priority: 10,
          conditions: [{ field: 'level', operator: 'gte', value: 1 }],
          promotion: { type: 'low_bonus', amount: 100 },
        },
        {
          id: 'high_priority',
          priority: 90,
          conditions: [{ field: 'level', operator: 'gte', value: 1 }],
          promotion: { type: 'high_bonus', amount: 1000 },
        },
      ];

      const playerData = { playerId: 'player123', level: 5 };
      const promotion = engine.selectPromotion(playerData);

      expect(promotion.type).toBe('high_bonus');
      expect(promotion.ruleId).toBe('high_priority');
    });

    test('should update metrics after selection', () => {
      const playerData = {
        playerId: 'player123',
        level: 1,
        country: 'US',
      };

      const initialEvaluations = engine.metrics.totalEvaluations;
      engine.selectPromotion(playerData);

      expect(engine.metrics.totalEvaluations).toBe(initialEvaluations + 1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle conflicting rules by priority', () => {
      engine.rules = [
        {
          id: 'rule1',
          priority: 50,
          conditions: [{ field: 'level', operator: 'eq', value: 10 }],
          promotion: { type: 'bonus1', amount: 500 },
        },
        {
          id: 'rule2',
          priority: 80,
          conditions: [{ field: 'level', operator: 'eq', value: 10 }],
          promotion: { type: 'bonus2', amount: 800 },
        },
      ];

      const playerData = { playerId: 'player123', level: 10 };
      const promotion = engine.selectPromotion(playerData);

      expect(promotion.ruleId).toBe('rule2'); // Higher priority
    });

    test('should handle unsupported country codes gracefully', () => {
      const playerData = {
        playerId: 'player123',
        level: 50,
        spendTier: 'platinum',
        daysSinceLastPurchase: 10,
        country: 'INVALID',
      };

      const promotion = engine.selectPromotion(playerData);
      // Should still get a promotion from fallback rules
      expect(promotion).not.toBeNull();
    });

    test('should handle invalid operator gracefully', () => {
      const condition = { field: 'level', operator: 'invalid_op', value: 10 };
      const playerData = { level: 10 };

      expect(engine.evaluateCondition(condition, playerData)).toBe(false);
    });
  });

  describe('Extensibility Hooks', () => {
    test('should apply time window filtering', () => {
      const rule = {
        id: 'time_limited',
        promotion: { type: 'time_bonus' },
        timeWindow: {
          start: '2024-01-01T00:00:00Z',
          end: '2023-12-31T23:59:59Z', // Past end date
        },
      };

      const result = engine.applyTimeWindows(rule, {});
      expect(result).toBeNull();
    });

    test('should pass through valid time windows', () => {
      const rule = {
        id: 'time_limited',
        promotion: { type: 'time_bonus' },
        timeWindow: {
          start: '2020-01-01T00:00:00Z',
          end: '2030-12-31T23:59:59Z',
        },
      };

      const result = engine.applyTimeWindows(rule, {});
      expect(result).toBe(rule);
    });
  });
});

describe('API Endpoints', () => {
  describe('POST /promotion', () => {
    test('should return promotion for valid player data', async () => {
      const playerData = {
        playerId: 'player123',
        level: 1,
        daysSinceRegistration: 1,
        totalSpent: 0,
      };

      const response = await request(app)
        .post('/promotion')
        .send(playerData)
        .expect(200);

      expect(response.body).toHaveProperty('promotion');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('should return 400 for invalid request body', async () => {
      await request(app).post('/promotion').send('invalid data').expect(400);
    });

    test('should handle missing player data gracefully', async () => {
      const response = await request(app)
        .post('/promotion')
        .send({})
        .expect(200);

      expect(response.body.promotion).toBeNull();
    });
  });

  describe('GET /metrics', () => {
    test('should return metrics data', async () => {
      const response = await request(app).get('/metrics').expect(200);

      expect(response.body).toHaveProperty('totalEvaluations');
      expect(response.body).toHaveProperty('hits');
      expect(response.body).toHaveProperty('misses');
      expect(response.body).toHaveProperty('hitRate');
      expect(response.body).toHaveProperty('averageLatencyMs');
      expect(response.body).toHaveProperty('totalRules');
    });
  });

  describe('POST /reload-rules', () => {
    test('should reload rules successfully', async () => {
      const response = await request(app).post('/reload-rules').expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health', () => {
    test('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('rulesLoaded');
    });
  });
});
