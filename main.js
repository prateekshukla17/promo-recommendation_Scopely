const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

class PromotionEngine {
  constructor() {
    this.rules = [];
    this.metrics = {
      totalEvaluations: 0,
      hits: 0,
      misses: 0,
      totalLatency: 0,
      lastReload: null,
    };
    this.loadRules();
  }

  loadRules() {
    try {
      const rulesPath = path.join(__dirname, 'rules.yaml');
      const fileContents = fs.readFileSync(rulesPath, 'utf8');
      const data = yaml.load(fileContents);

      this.rules = data.rules.sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      );
      this.metrics.lastReload = new Date().toISOString();

      console.log(`Loaded ${this.rules.length} promotion rules`);
    } catch (error) {
      console.error('Error loading rules:', error.message);
      this.rules = [];
    }
  }

  evaluateCondition(condition, playerData) {
    const { field, operator, value } = condition;
    const playerValue = this.getNestedValue(playerData, field);

    if (playerValue === undefined || playerValue === null) {
      return false;
    }

    switch (operator) {
      case 'eq':
        return playerValue === value;
      case 'neq':
        return playerValue !== value;
      case 'gt':
        return Number(playerValue) > Number(value);
      case 'gte':
        return Number(playerValue) >= Number(value);
      case 'lt':
        return Number(playerValue) < Number(value);
      case 'lte':
        return Number(playerValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(playerValue);
      case 'nin':
        return Array.isArray(value) && !value.includes(playerValue);
      case 'contains':
        return String(playerValue)
          .toLowerCase()
          .includes(String(value).toLowerCase());
      case 'regex':
        return new RegExp(value).test(String(playerValue));
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  evaluateRule(rule, playerData) {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true;
    }

    const logic = rule.logic || 'AND';

    if (logic === 'AND') {
      return rule.conditions.every((condition) =>
        this.evaluateCondition(condition, playerData)
      );
    } else if (logic === 'OR') {
      return rule.conditions.some((condition) =>
        this.evaluateCondition(condition, playerData)
      );
    }

    return false;
  }

  // Extensibility hooks for future features
  applyWeightedRandomness(eligibleRules, playerData) {
    // Hook for weighted random selection based on rule weights
    if (eligibleRules.length === 0) return null;

    // For now, return the first rule (highest priority)
    // Future: implement weighted selection based on rule.weight
    return eligibleRules[0];
  }

  applyABTesting(rule, playerData) {
    // Hook for A/B testing buckets
    // Future: check if player is in correct bucket for this rule
    return rule;
  }

  applyTimeWindows(rule, playerData) {
    // Hook for time-based rule activation
    const now = new Date();

    if (rule.timeWindow) {
      const { start, end } = rule.timeWindow;
      if (start && new Date(start) > now) return null;
      if (end && new Date(end) < now) return null;
    }

    return rule;
  }

  selectPromotion(playerData) {
    const startTime = Date.now();
    this.metrics.totalEvaluations++;

    try {
      // Validate required player data
      if (!this.validatePlayerData(playerData)) {
        throw new Error('Invalid or missing required player attributes');
      }

      // Find all eligible rules
      const eligibleRules = this.rules.filter((rule) => {
        if (!this.evaluateRule(rule, playerData)) return false;

        // Apply extensibility hooks
        const afterTimeWindow = this.applyTimeWindows(rule, playerData);
        if (!afterTimeWindow) return false;

        const afterABTest = this.applyABTesting(afterTimeWindow, playerData);
        if (!afterABTest) return false;

        return true;
      });

      // Apply weighted randomness to select final promotion
      const selectedRule = this.applyWeightedRandomness(
        eligibleRules,
        playerData
      );

      const endTime = Date.now();
      const latency = endTime - startTime;
      this.metrics.totalLatency += latency;

      if (selectedRule) {
        this.metrics.hits++;
        return {
          ...selectedRule.promotion,
          ruleId: selectedRule.id,
          selectedAt: new Date().toISOString(),
        };
      } else {
        this.metrics.misses++;
        return null;
      }
    } catch (error) {
      const endTime = Date.now();
      const latency = endTime - startTime;
      this.metrics.totalLatency += latency;
      this.metrics.misses++;

      console.error('Error selecting promotion:', error.message);
      return null;
    }
  }

  validatePlayerData(playerData) {
    // Basic validation - ensure required fields exist
    const requiredFields = ['playerId'];
    return requiredFields.every((field) => playerData[field] !== undefined);
  }

  getMetrics() {
    const avgLatency =
      this.metrics.totalEvaluations > 0
        ? this.metrics.totalLatency / this.metrics.totalEvaluations
        : 0;

    return {
      totalEvaluations: this.metrics.totalEvaluations,
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate:
        this.metrics.totalEvaluations > 0
          ? ((this.metrics.hits / this.metrics.totalEvaluations) * 100).toFixed(
              2
            ) + '%'
          : '0%',
      averageLatencyMs: Math.round(avgLatency * 100) / 100,
      totalRules: this.rules.length,
      lastReload: this.metrics.lastReload,
    };
  }

  reloadRules() {
    const oldRuleCount = this.rules.length;
    this.loadRules();
    return {
      success: true,
      message: `Rules reloaded successfully. Old count: ${oldRuleCount}, New count: ${this.rules.length}`,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = {
  PromotionEngine,
};
