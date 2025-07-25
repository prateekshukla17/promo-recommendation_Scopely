const express = require('express');
const { PromotionEngine } = require('./main');
const app = express();
const ruleEngine = new PromotionEngine();
const { promotionController } = require('./controllers');
const { metricsController } = require('./controllers');
const { reloadRulesController } = require('./controllers');

const port = 3000;
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.post('/promotion', promotionController);

app.get('/metrics', metricsController);

app.post('reload-rules', reloadRulesController);

app.get('/health', (req, res) => {
  res.json({
    status: 'Healthy',
    timestamp: new Date().toISOString(),
    rulesLoaded: ruleEngine.rules.length,
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
  });
});
app.listen(port, () => {
  console.log(`Promotion Rule Engine running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
