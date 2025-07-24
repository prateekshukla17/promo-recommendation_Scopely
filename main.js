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
}
