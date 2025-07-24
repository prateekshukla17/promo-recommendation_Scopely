const express = require('express');
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

      // Sort rules by priority (higher priority first)
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

  evaluateConditions = () => {
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
  };

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
}
