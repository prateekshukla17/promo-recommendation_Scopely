const { PromotionEngine } = require('./main');
const ruleEngine = new PromotionEngine();

const promotionController = (req, res) => {
  try {
    const playerData = req.body;
    if (!playerData || typeof playerData !== 'object') {
      return res.status(400).json({
        error: 'Invalid request body. Expected JSON object with player data.',
      });
    }
    const promotion = ruleEngine.selectPromotion(playerData);
    res.json({
      promotion,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /promotion endpoint:', error);
    res.status(500).json({
      error: 'Internal server error during promotion selection',
    });
  }
};

const metricsController = (req, res) => {
  try {
    const metrics = ruleEngine.getMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error in /metrics endpoint:', error);
    res.status(500).json({
      error: 'Internal server error while fetching metrics',
    });
  }
};

const reloadRulesController = (req, res) => {
  try {
    const result = ruleEngine.reloadRules();
    res.json(result);
  } catch (error) {
    console.error('Error in /reload-rules endpoint:', error);
    res.status(500).json({
      error: 'Internal server error while reloading rules',
    });
  }
};

module.exports = {
  promotionController,
  metricsController,
  reloadRulesController,
};
