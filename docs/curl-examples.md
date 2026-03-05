# Curl Examples — Robots Simulation API

Base URL: `http://localhost:3000/api/v1`

All examples assume the server is running via `npm run dev:server`.

---

## Create a Simulation (§4.1)

```bash
curl -s -X POST http://localhost:3000/api/v1/simulations \
  -H "Content-Type: application/json" \
  -d '{"robotCount": 3, "moveSequence": "^^VV<>"}' | jq
```

**201 Created**

```json
{
  "simulation": {
    "id": 1,
    "robotCount": 3,
    "moveSequence": "^^VV<>",
    "currentStep": 0,
    "totalSteps": 6,
    "status": "created",
    "createdAt": "2026-03-05T12:00:00.000Z"
  },
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": 0, "y": 0 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 0, "y": 0 } }
  ]
}
```

`robotCount` defaults to 1 when omitted. Lowercase `v` in `moveSequence` is normalized to `V`.

---

## Step One Turn (§4.2)

```bash
curl -s -X POST http://localhost:3000/api/v1/simulations/1/step | jq
```

**200 OK**

```json
{
  "turn": {
    "robotName": "Robbie",
    "direction": "^",
    "from": { "x": 0, "y": 0 },
    "to": { "x": 0, "y": 1 },
    "delivered": true,
    "message": "Robbie moved to (0, 1) and delivered a present!"
  },
  "simulation": {
    "id": 1,
    "currentStep": 1,
    "totalSteps": 6,
    "status": "running"
  }
}
```

When blocked by another robot:

```json
{
  "turn": {
    "delivered": false,
    "message": "Jane moved to (0, 1) but couldn't deliver — another robot was already there."
  }
}
```

---

## Run Full Simulation (§4.3)

```bash
curl -s -X POST http://localhost:3000/api/v1/simulations/1/run | jq
```

**200 OK**

```json
{
  "simulation": {
    "id": 1,
    "currentStep": 6,
    "totalSteps": 6,
    "status": "completed"
  },
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": -1, "y": 1 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 1, "y": -1 } }
  ],
  "summary": {
    "totalPresentsDelivered": 5,
    "housesWithPresents": 5
  }
}
```

Also works on partially-stepped simulations — picks up from the current step.

---

## List All Simulations (§4.7)

```bash
curl -s http://localhost:3000/api/v1/simulations | jq
```

**200 OK**

```json
{
  "simulations": [
    {
      "id": 2,
      "robotCount": 1,
      "moveSequence": ">>>",
      "currentStep": 0,
      "totalSteps": 3,
      "status": "created",
      "createdAt": "2026-03-05T12:01:00.000Z"
    },
    {
      "id": 1,
      "robotCount": 3,
      "moveSequence": "^^VV<>",
      "currentStep": 6,
      "totalSteps": 6,
      "status": "completed",
      "createdAt": "2026-03-05T12:00:00.000Z"
    }
  ]
}
```

Ordered newest first.

---

## Get Simulation Details (§4.8)

```bash
curl -s http://localhost:3000/api/v1/simulations/1 | jq
```

**200 OK**

```json
{
  "simulation": {
    "id": 1,
    "robotCount": 3,
    "moveSequence": "^^VV<>",
    "currentStep": 6,
    "totalSteps": 6,
    "status": "completed",
    "createdAt": "2026-03-05T12:00:00.000Z"
  },
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": -1, "y": 1 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 1, "y": -1 } }
  ],
  "summary": {
    "totalPresentsDelivered": 5,
    "housesWithPresents": 5
  }
}
```

---

## Get Robot Positions (§4.4)

```bash
curl -s http://localhost:3000/api/v1/simulations/1/robots | jq
```

**200 OK**

```json
{
  "simulationId": 1,
  "currentStep": 6,
  "robots": [
    { "name": "Robbie", "turnOrder": 0, "position": { "x": 0, "y": 0 } },
    { "name": "Jane", "turnOrder": 1, "position": { "x": -1, "y": 1 } },
    { "name": "Bob", "turnOrder": 2, "position": { "x": 1, "y": -1 } }
  ]
}
```

---

## Count Houses by Threshold (§4.5)

```bash
curl -s "http://localhost:3000/api/v1/simulations/1/houses?minPresents=1" | jq
```

**200 OK**

```json
{
  "simulationId": 1,
  "minPresents": 1,
  "houseCount": 5
}
```

---

## Get Total Presents (§4.6)

```bash
curl -s http://localhost:3000/api/v1/simulations/1/presents | jq
```

**200 OK**

```json
{
  "simulationId": 1,
  "totalPresents": 5
}
```

---

## Error Responses

All errors follow the same shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### 400 — Validation Error

```bash
curl -s -X POST http://localhost:3000/api/v1/simulations \
  -H "Content-Type: application/json" \
  -d '{"robotCount": 0, "moveSequence": ">"}' | jq
```

```json
{
  "error": {
    "code": "INVALID_ROBOT_COUNT",
    "message": "robotCount must be an integer between 1 and 20"
  }
}
```

### 404 — Not Found

```bash
curl -s http://localhost:3000/api/v1/simulations/999 | jq
```

```json
{
  "error": {
    "code": "SIMULATION_NOT_FOUND",
    "message": "No simulation found with id 999"
  }
}
```

### 409 — Conflict (simulation already completed)

```bash
# Attempting to step a completed simulation:
curl -s -X POST http://localhost:3000/api/v1/simulations/1/step | jq
```

```json
{
  "error": {
    "code": "SIMULATION_COMPLETED",
    "message": "Simulation 1 is already completed"
  }
}
```
