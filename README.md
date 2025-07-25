# Promotion Rule Engine Microservice

A REST microservice that selects the most appropriate in-game promotion for players based on configurable business rules defined in YAML.

## Features

- **Configurable Rules**: Define promotion rules via YAML with complex conditions
- **Priority-Based Selection**: Rules are evaluated by priority order
- **Hot Reload**: Update rules without restarting the service
- **Comprehensive Metrics**: Track evaluation performance and hit rates
- **Extensibility Hooks**: Built-in support for future A/B testing, weighted randomness, and time windows
- **Edge Case Handling**: Robust handling of invalid data, conflicting rules, and missing attributes

## Quick Start

### Installation

```bash

git clone <repository-url>
cd promo-recommendation

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on port 3000 by default.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## API Endpoints

### POST /promotion

Evaluates player data against promotion rules and returns the best matching promotion.

**Request Body:**

```json
{
  "playerId": "player123",
  "level": 25,
  "spendTier": "gold",
  "country": "US",
  "daysSinceLastPurchase": 5,
  "daysSinceLastLogin": 1,
  "totalSpent": 150.0,
  "daysSinceRegistration": 45
}
```

**Response:**

```json
{
  "promotion": {
    "type": "loyalty_bonus",
    "amount": 5000,
    "description": "Thank you for your loyalty! 5,000 bonus credits!",
    "validForDays": 10,
    "metadata": {
      "category": "loyalty",
      "source": "high_value"
    },
    "ruleId": "big_spender_reward",
    "selectedAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response (No Match):**

```json
{
  "promotion": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /metrics

Returns performance metrics for the promotion engine.

**Response:**

```json
{
  "totalEvaluations": 1,
  "hits": 1,
  "misses": 0,
  "hitRate": "100.00%",
  "averageLatencyMs": 0,
  "totalRules": 9,
  "lastReload": "2025-07-25T05:24:44.386Z"
}
```

### POST /reload-rules

Hot-reloads promotion rules from the YAML file without restarting the service.

**Response:**

```json
{
  "success": true,
  "message": "Rules reloaded successfully. Old count: 9, New count: 10",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /health

Returns service health status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "rulesLoaded": 9
}
```

## Rule Configuration

Rules are defined in `rules.yaml`. Each rule contains:

- **id**: Unique identifier
- **name**: Human-readable name
- **priority**: Higher numbers = higher priority (evaluated first)
- **logic**: "AND" or "OR" for combining conditions
- **conditions**: Array of condition objects
- **promotion**: The promotion payload to return
- **timeWindow**: Optional start/end dates for rule activation

### Condition Operators

- `eq`: Equal to
- `neq`: Not equal to
- `gt`: Greater than
- `gte`: Greater than or equal to
- `lt`: Less than
- `lte`: Less than or equal to
- `in`: Value is in array
- `nin`: Value is not in array
- `contains`: String contains substring (case-insensitive)
- `regex`: Regular expression match

### Example Rule

```yaml
- id: 'vip_mega_bonus'
  name: 'VIP Mega Bonus'
  priority: 100
  logic: 'AND'
  conditions:
    - field: 'level'
      operator: 'gte'
      value: 50
    - field: 'spendTier'
      operator: 'in'
      value: ['platinum', 'diamond']
    - field: 'daysSinceLastPurchase'
      operator: 'gte'
      value: 7
  promotion:
    type: 'bonus_credits'
    amount: 10000
    description: 'Exclusive VIP Mega Bonus - 10,000 credits!'
    validForDays: 7
  timeWindow:
    start: '2024-01-01T00:00:00Z'
    end: '2024-12-31T23:59:59Z'
```

## Testing with cURL

### Test Promotion Selection

```bash
# New player
curl -X POST http://localhost:3000/promotion \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "newbie123",
    "level": 3,
    "daysSinceRegistration": 2,
    "totalSpent": 0,
    "country": "US"
  }'

# VIP player
curl -X POST http://localhost:3000/promotion \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "vip456",
    "level": 55,
    "spendTier": "platinum",
    "daysSinceLastPurchase": 10,
    "country": "US",
    "totalSpent": 2500.00
  }'
```

### Check Metrics

```bash
curl http://localhost:3000/metrics
```

### Reload Rules

```bash
curl -X POST http://localhost:3000/reload-rules
```

### Health Check

```bash
curl http://localhost:3000/health
```

## Architecture & Design

### Core Components

1. **PromotionRuleEngine Class**: Main business logic
2. **Express Server**: REST API endpoints
3. **Controllers**: API Handler functions
4. **YAML Rule Configuration**: External rule definitions
5. **Metrics Collection**: Performance tracking

### Rule Evaluation Flow

1. Load player data from request
2. Validate required fields
3. Iterate through rules by priority
4. Evaluate conditions using specified logic (AND/OR)
5. Apply extensibility hooks (time windows, A/B testing)
6. Return first matching promotion
7. Update metrics

### Extensibility Hooks

The system includes three main extensibility points:

#### 1. Weighted Randomness

```javascript
applyWeightedRandomness(eligibleRules, playerData) {
  // Future: implement weighted selection based on rule.weight
  // Currently returns highest priority rule
}
```

#### 2. A/B Testing

```javascript
applyABTesting(rule, playerData) {
  // Future: check if player is in correct bucket for this rule
  // Currently passes through all rules
}
```

#### 3. Time Windows

```javascript
applyTimeWindows(rule, playerData) {
  // Implemented: filters rules based on start/end dates
  // Can be extended for recurring time patterns
}
```

### Performance Considerations

- **In-Memory Storage**: Rules loaded at startup for fast access
- **Priority Sorting**: Rules pre-sorted by priority to short-circuit evaluation
- **Metrics Collection**: Minimal overhead tracking for monitoring
- **Hot Reload**: Rules can be updated without service restart

### Error Handling

- Invalid player data returns `null` promotion
- Missing required fields handled gracefully
- Unknown operators log warnings but don't crash
- Malformed YAML files logged with fallback to empty rules
- All endpoints include proper HTTP status codes

## Edge Cases Handled

1. **Conflicting Rules**: Resolved by priority order
2. **Missing Player Attributes**: Conditions fail gracefully
3. **Invalid Country Codes**: Handled by rule logic
4. **Large Rule Sets**: Efficient priority-based evaluation
5. **Malformed Rules**: Logged and skipped
6. **Network Issues**: Proper HTTP error responses

## Monitoring & Observability

The `/metrics` endpoint provides:

- Total rule evaluations
- Hit/miss ratios
- Average response latency
- Rule reload timestamps
- Current rule count
